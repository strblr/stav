import type { Store, State } from "../create";
import { create } from "./object.js";
import { effect } from "./effect.js";
import { getTransaction, nofork } from "../transaction.js";
import { assign } from "../utils.js";

export interface PersistStore {
  persist: ReturnType<
    typeof create<
      { hydrating: boolean; hydrated: boolean },
      { hydrate(): void }
    >
  >;
}

export interface PersistOptions<T, P, R> {
  key?: string;
  version?: number;
  autoHydrate?: boolean;
  storage?: StorageLike<R> | null;
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
    key = "stav/persist",
    version = 1,
    autoHydrate = true,
    storage = typeof window !== "undefined"
      ? (window.localStorage as Default<"storage">)
      : null,
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
        if (!storage || persist.get().hydrating || getTransaction()) {
          return;
        }
        const success = () => {
          persist.assign({ hydrated: true });
        };
        try {
          persist.assign({ hydrating: true });
          const serialized = storage.getItem(key);
          if (serialized === null) {
            return success();
          }
          let [partialized, storedVersion] = deserialize(serialized);
          if (storedVersion !== version) {
            if (!migrate) {
              return success();
            }
            partialized = migrate(partialized, storedVersion);
          }
          const state = store.get();
          const nextState = merge(partialized, state);
          store.set(nextState);
          success();
        } catch (error) {
          onError(error, "hydrate");
          throw error;
        } finally {
          persist.assign({ hydrating: false });
        }
      }
    }
  );

  assign(persist, { [nofork]: true });

  effect(store, state => {
    if (!storage || persist.get().hydrating || getTransaction()) {
      return;
    }
    try {
      const partialized = partialize(state);
      const serialized = serialize([partialized, version]);
      storage.setItem(key, serialized);
    } catch (error) {
      onError(error, "persist");
    }
  });

  if (autoHydrate) {
    try {
      persist.hydrate();
    } catch {}
  }

  return assign<S, PersistStore>(store, { persist });
}

// Utils

export interface StorageLike<R> {
  getItem: (key: string) => R | null;
  setItem: (key: string, serialized: R) => void;
}

export type Versioned<P> = readonly [partialized: P, version: number];
