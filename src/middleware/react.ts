import { useSyncExternalStore, useDebugValue, useCallback } from "react";
import type { Assign, BaseStore, State } from "../create";

export interface ReactStore<T> {
  use: {
    (): T;
    <U>(selector: (state: T) => U): U;
  };
}

export function react<S extends BaseStore<any>>(
  store: S
): Assign<S, ReactStore<State<S>>> {
  type T = State<S>;

  const reactStore: ReactStore<T> = {
    use: (selector = (state: T) => state) => {
      const slice = useSyncExternalStore(
        store.subscribe,
        useCallback(() => selector(store.get()), [selector]),
        useCallback(() => selector(store.getInitial()), [selector])
      );
      useDebugValue(slice);
      return slice;
    }
  };

  return { ...store, ...reactStore };
}
