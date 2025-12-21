import { create, type Store, type State } from "../create.js";
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
  onHydrateStart?: () => void;
  onHydrate?: () => void;
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
    onHydrateStart,
    onHydrate,
    onError = error => {
      throw error;
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
          persist.set(state => ({ ...state, hydrating: true }));
          onHydrateStart?.();
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
          persist.set(state => ({ ...state, hydrated: true }));
          onHydrate?.();
        } catch (error) {
          onError(error, "hydrate");
        } finally {
          persist.set(state => ({ ...state, hydrating: false }));
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

  const persistStore: PersistStore = { persist };

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

  return assign(store, persistStore);
}

// Utils

export interface StorageLike<R> {
  getItem: (key: string) => R | null;
  setItem: (key: string, serialized: R) => void;
}

export type Versioned<P> = readonly [partialized: P, version: number];
