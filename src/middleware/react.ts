import { useSyncExternalStore, useDebugValue, useRef } from "react";
import {
  create as vanilla,
  type Store,
  type EqualFn,
  type State
} from "../create.js";
import { type Assign, assign } from "../utils.js";

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

// create

export function create<T, H extends object = {}>(
  initialState: T,
  handlers?: H,
  equalFn?: EqualFn<T>
) {
  const store = vanilla(initialState, handlers, equalFn);
  return react(store as any) as Assign<typeof store, ReactStore<T>>;
}

// Utils

const uninitialized = Symbol();
