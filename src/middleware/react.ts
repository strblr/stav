import { useSyncExternalStore, useDebugValue, useRef } from "react";
import type { Store, EqualFn, State } from "../create";
import { assign } from "../utils.js";

export interface ReactStore<T> {
  use: <U = T>(selector?: (state: T) => U, equalFn?: EqualFn<U>) => U;
}

export function react<S extends Store<any>>(store: S) {
  return assign<S, ReactStore<State<S>>>(store, {
    use: (...args) => useStore(store, ...args)
  });
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
    () => getSlice(store.getInitial())
  );

  useDebugValue(slice);
  return slice;
}

// Utils

const uninitialized = Symbol();
