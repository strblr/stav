import { useSyncExternalStore, useDebugValue, useRef } from "react";
import {
  create as vanilla,
  type Assign,
  type Store,
  type EqualFn,
  type State
} from "../create.js";

export interface ReactStore<T> {
  use: <U = T>(selector?: (state: T) => U, equalFn?: EqualFn<U>) => U;
}

export function react<S extends Store<any>>(
  store: S
): Assign<S, ReactStore<State<S>>> {
  type T = State<S>;

  const reactStore: ReactStore<T> = {
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
    () => getSlice(store.getInitial())
  );

  useDebugValue(slice);
  return slice;
}

// create

export function create<T, H extends object = {}>(
  initialState: T,
  handlers?: H
) {
  const store = vanilla(initialState, handlers);
  return react(store as any) as Assign<typeof store, ReactStore<T>>;
}

// Utils

const uninitialized = Symbol();
