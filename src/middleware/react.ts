import {
  useSyncExternalStore,
  useDebugValue,
  useRef,
  useEffect,
  useState
} from "react";
import type { Store, EqualFn, State } from "../create.js";
import type { PersistStore } from "./persist.js";
import type { AsyncPersistStore } from "./async-persist.js";
import type { Assign } from "../utils.js";

export interface ReactStore<T> {
  use: <U = T>(selector?: (state: T) => U, equalFn?: EqualFn<U>) => U;
}

export function react<S extends Store<any>>(
  store: S
): Assign<S, ReactStore<State<S>>> {
  const reactStore: ReactStore<State<S>> = {
    use: (...args) => useStore(store, ...args)
  };
  return Object.assign(store, reactStore);
}

// useStore

export function useStore<T, U = T>(
  store: Store<T>,
  selector = (state: T) => state as any as U,
  equalFn?: EqualFn<U>
) {
  const previous = useRef<U | typeof uninitialized>(uninitialized);

  const getSlice = (state: any) => {
    const next = selector(state);
    if (!equalFn) {
      return next;
    }
    if (previous.current === uninitialized) {
      previous.current = next;
      return next;
    }
    return equalFn(previous.current, next)
      ? previous.current
      : (previous.current = next);
  };

  const slice = useSyncExternalStore(
    store.subscribe,
    () => getSlice(store.get()),
    () => getSlice(store.get.initial())
  );

  useDebugValue(slice);
  return slice;
}

// useHydration

export function useHydration(stores: (PersistStore | AsyncPersistStore)[]) {
  const [hydrated, setHydrated] = useState(() =>
    stores.every(store => store.persist.get().hydrated)
  );

  useEffect(() => {
    const promise = stores
      .filter(store => !store.persist.get().hydrated)
      .map(store => {
        const promise = new Promise<void>(resolve => {
          const unsubscribe = store.persist.subscribe(state => {
            if (!state.hydrated) return;
            unsubscribe();
            resolve();
          });
          store.persist.hydrate();
        });
        return promise;
      });
    Promise.all(promise).then(() => setHydrated(true));
  }, stores);

  return hydrated;
}

// Utils

const uninitialized = Symbol();
