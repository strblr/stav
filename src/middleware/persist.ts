import type { Store, State } from "../create";
import { create } from "./object.js";
import { getTransaction } from "../transaction.js";
import { assign } from "../utils.js";

export interface PersistStore {
  persist: ReturnType<
    typeof create<
      { hydrating: boolean; hydrated: boolean },
      { hydrate(): void; persist(): void }
    >
  >;
}

export interface PersistOptions<T, P, R> {
  key?: string;
  version?: number;
  autoHydrate?: boolean;
  storage?: StorageLike<R>;
  partialize?: (state: T) => P;
  serialize?: (partialized: Versioned<P>) => R;
  deserialize?: (serialized: R) => Versioned<P>;
  migrate?: (partialized: any, version: number) => P;
  merge?: (partialized: P, state: T) => T;
  onError?: (error: unknown, during: "hydrate" | "persist") => void;
}

export function persist<S extends Store<any>, P = State<S>, R = string>(
  store: S,
  options: PersistOptions<State<S>, P, R> = {}
) {
  type T = State<S>;
  type Default<O extends keyof PersistOptions<T, P, R>> = NonNullable<
    PersistOptions<T, P, R>[O]
  >;

  const {
    key = "stav-persist",
    version = 1,
    autoHydrate = true,
    storage = typeof window !== "undefined"
      ? (window.localStorage as Default<"storage">)
      : undefined,
    partialize = (state => state) as Default<"partialize">,
    serialize = JSON.stringify as Default<"serialize">,
    deserialize = JSON.parse as Default<"deserialize">,
    migrate,
    merge = (partialized => partialized) as Default<"merge">,
    onError = (error, during) => {
      console.error(`[stav/persist] ${during} error:`, error);
    }
  } = options;

  const persist = create(
    {
      hydrating: false,
      hydrated: false
    },
    {
      hydrate: () => {
        if (!storage || persist.get().hydrating) {
          return;
        }
        try {
          persist.assign({ hydrating: true });
          const serialized = storage.getItem(key);
          if (serialized === null) {
            return;
          }
          let [partialized, storedVersion] = deserialize(serialized);
          if (storedVersion !== version) {
            if (!migrate) return;
            partialized = migrate(partialized, storedVersion);
          }
          const state = store.get();
          const nextState = merge(partialized, state);
          store.set(() => nextState);
          persist.assign({ hydrated: true });
        } catch (error) {
          onError(error, "hydrate");
        } finally {
          persist.assign({ hydrating: false });
        }
      },
      persist: () => {
        if (!storage || persist.get().hydrating) {
          return;
        }
        try {
          const partialized = partialize(store.get());
          const serialized = serialize([partialized, version]);
          storage.setItem(key, serialized);
        } catch (error) {
          onError(error, "persist");
        }
      }
    }
  );

  const { set } = store;
  store.set = nextState => {
    set(nextState);
    if (!getTransaction()) {
      persist.persist();
    }
  };

  if (autoHydrate) {
    persist.hydrate();
  }

  return assign<S, PersistStore>(store, { persist });
}

// Utils

export interface StorageLike<R> {
  getItem: (key: string) => R | null;
  setItem: (key: string, serialized: R) => void;
}

export type Versioned<P> = readonly [partialized: P, version: number];
