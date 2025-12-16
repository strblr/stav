import { useSyncExternalStore, useDebugValue, useRef } from "react";
import type { Assign, BaseStore, State } from "../create";

export interface ReactStore<T> {
  use: {
    (): T;
    <U>(selector: (state: T) => U, equalFn?: (a: U, b: U) => boolean): U;
  };
}

export function react<S extends BaseStore<any>>(
  store: S
): Assign<S, ReactStore<State<S>>> {
  type T = State<S>;

  const reactStore: ReactStore<T> = {
    use: (selector = (state: T) => state, equalFn = Object.is) => {
      const previous = useRef<T>(undefined as T);

      const memoSelector = (state: T) => {
        const next = selector(state);
        return equalFn(previous.current, next)
          ? previous.current
          : (previous.current = next);
      };

      const slice = useSyncExternalStore(
        store.subscribe,
        () => memoSelector(store.get()),
        () => memoSelector(store.getInitial())
      );

      useDebugValue(slice);
      return slice;
    }
  };

  return { ...store, ...reactStore };
}
