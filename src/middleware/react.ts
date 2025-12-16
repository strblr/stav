import { useSyncExternalStore, useDebugValue, useRef } from "react";
import type { Assign, BaseStore, State } from "../create";

export interface ReactStore<T> {
  use: {
    (): T;
    <U>(
      selector: (state: T) => U,
      equalFn?: (slice: U, nextSlice: U) => boolean
    ): U;
  };
}

export function react<S extends BaseStore<any>>(
  store: S
): Assign<S, ReactStore<State<S>>> {
  type T = State<S>;

  const reactStore: ReactStore<T> = {
    use: (selector = (state: T) => state, equalFn?: typeof Object.is) => {
      const previous = useRef<any>(uninitialized);

      const getSlice = (state: T) => {
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
  };

  return { ...store, ...reactStore };
}

// Utils

const uninitialized = Symbol();
