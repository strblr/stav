import type { Store, State } from "../create";
import type { Versioned } from "./persist";
import { create } from "./object.js";
import { getTransaction } from "../transaction.js";
import { assign, debounce } from "../utils.js";

export interface AsyncPersistStore {
  persist: ReturnType<
    typeof create<
      { hydrating: boolean; hydrated: boolean; persisting: boolean },
      { hydrate(): Promise<void>; cancelPersist(): void }
    >
  >;
}

export interface AsyncPersistOptions<T, P, R> {
  key?: string;
  version?: number;
  autoHydrate?: boolean;
  debounce?: number;
  storage?: AsyncStorageLike<R> | null;
  partialize?: (state: T) => P;
  serialize?: (partialized: Versioned<P>) => R;
  deserialize?: (serialized: R) => Versioned<P>;
  migrate?: (partialized: any, version: number) => P | Promise<P>;
  merge?: (partialized: P, state: T) => T;
  onError?: (error: unknown, during: "hydrate" | "persist") => void;
}

export function persist<S extends Store<any>, P = State<S>, R = Versioned<P>>(
  store: S,
  options: AsyncPersistOptions<State<S>, P, R> = {}
) {
  type T = State<S>;
  type Default<O extends keyof AsyncPersistOptions<T, P, R>> = NonNullable<
    AsyncPersistOptions<T, P, R>[O]
  >;

  const {
    key = "stav/async-persist",
    version = 1,
    autoHydrate = true,
    debounce: delay = 0,
    storage,
    partialize = (state => state) as Default<"partialize">,
    serialize = (partialized => partialized) as Default<"serialize">,
    deserialize = (partialized => partialized) as Default<"deserialize">,
    migrate,
    merge = (partialized => partialized) as Default<"merge">,
    onError = (error, during) => {
      console.error(`[stav/async-persist] ${during} error:`, error);
    }
  } = options;

  const persist = create(
    {
      hydrating: false,
      hydrated: false,
      persisting: false
    },
    {
      hydrate: async () => {
        if (!storage || persist.get().hydrating || getTransaction()) {
          return;
        }
        const success = () => {
          persist.assign({ hydrated: true });
        };
        try {
          persist.assign({ hydrating: true });
          const serialized = await storage.getItem(key);
          if (serialized === null) {
            return success();
          }
          let [partialized, storedVersion] = deserialize(serialized);
          if (storedVersion !== version) {
            if (!migrate) {
              return success();
            }
            partialized = await migrate(partialized, storedVersion);
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
      },
      cancelPersist: () => {
        debouncedPersist.cancel();
      }
    }
  );

  const { set } = store;

  const debouncedPersist = debounce(async () => {
    try {
      persist.assign({ persisting: true });
      const partialized = partialize(store.get());
      const serialized = serialize([partialized, version]);
      await storage?.setItem(key, serialized);
    } catch (error) {
      onError(error, "persist");
    } finally {
      persist.assign({ persisting: false });
    }
  }, delay);

  store.set = (...args) => {
    set(...args);
    if (!storage || persist.get().hydrating || getTransaction()) {
      return;
    }
    debouncedPersist();
  };

  if (autoHydrate) {
    persist.hydrate();
  }

  return assign<S, AsyncPersistStore>(store, { persist });
}

// Utils

export interface AsyncStorageLike<R> {
  getItem: (key: string) => Promise<R | null>;
  setItem: (key: string, serialized: R) => Promise<void>;
}
