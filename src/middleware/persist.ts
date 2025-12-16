import type { Assign, BaseStore, State } from "../create";

export interface PersistStore {
  persist: {
    hydrated: boolean;
    hydrate: () => void;
    clear: () => void;
  };
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
  onHydrate?: (state: T, previousState: T) => void;
  onError?: (error: unknown, action: "hydrate" | "set" | "clear") => void;
}

export function persist<S extends BaseStore<any>, P = State<S>, R = string>(
  store: S,
  options: PersistOptions<State<S>, P, R> = {}
): Assign<S, PersistStore> {
  type T = State<S>;
  let hydrated = false;

  const defaultOptions = {
    key: "stav-persist",
    version: 1,
    autoHydrate: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    partialize: state => state,
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    merge: partialized => partialized
  } satisfies PersistOptions<T, T, string> as any as Required<
    Omit<PersistOptions<T, P, R>, "storage" | "migrate">
  >;

  const {
    key,
    version,
    autoHydrate,
    storage,
    partialize,
    serialize,
    deserialize,
    migrate,
    merge,
    onHydrate,
    onError
  } = { ...defaultOptions, ...options };

  const set: S["set"] = nextState => {
    store.set(nextState);
    if (!storage) return;
    try {
      const partialized = partialize(store.get());
      const serialized = serialize([partialized, version]);
      storage.setItem(key, serialized);
    } catch (error) {
      onError?.(error, "set");
    }
  };

  const persistStore: PersistStore = {
    persist: {
      get hydrated() {
        return hydrated;
      },
      hydrate() {
        if (!storage) return;
        try {
          const serialized = storage.getItem(key);
          if (serialized === null) return;
          let [partialized, storedVersion] = deserialize(serialized);
          if (storedVersion !== version) {
            if (!migrate) return;
            partialized = migrate(partialized, storedVersion);
          }
          const previousState = store.get();
          store.set(() => merge(partialized, previousState));
          hydrated = true;
          onHydrate?.(store.get(), previousState);
        } catch (error) {
          onError?.(error, "hydrate");
        }
      },
      clear() {
        if (!storage) return;
        try {
          storage.removeItem(key);
        } catch (error) {
          onError?.(error, "clear");
        }
      }
    }
  };

  if (autoHydrate) {
    persistStore.persist.hydrate();
  }

  return { ...store, set, ...persistStore };
}

// Utils

export interface StorageLike<R> {
  getItem: (key: string) => R | null;
  setItem: (key: string, serialized: R) => void;
  removeItem: (key: string) => void;
}

export type Versioned<P> = readonly [partialized: P, version: number];
