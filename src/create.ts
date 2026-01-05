import type { Assign } from "./utils.js";

export interface Store<T> {
  get: { (): T; initial: () => T };
  set: (nextState: StoreUpdater<T>) => void;
  subscribe: (listener: StoreListener<T>) => () => void;
}

export function create<T, H extends object = {}>(
  initialState: T,
  handlers = {} as H,
  equalFn: EqualFn<T> = Object.is
): Assign<Store<T>, H> {
  let state = initialState;
  const listeners = new Set<StoreListener<T>>();

  const store: Store<T> = {
    get: Object.assign(() => state, {
      initial: () => initialState
    }),
    set: nextState => {
      nextState =
        typeof nextState === "function"
          ? (nextState as (state: T) => T)(state)
          : nextState;
      if (equalFn(state, nextState)) return;
      const previousState = state;
      state = nextState;
      for (const listener of listeners.keys()) {
        listener(state, previousState);
      }
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };

  return Object.assign(store, handlers);
}

// Utils

export type StoreUpdater<T> = T | ((state: T) => T);

export type StoreListener<T> = (state: T, previousState: T) => void;

export type State<S extends Store<any>> = ReturnType<S["get"]>;

export type EqualFn<T> = (state: T, nextState: T) => boolean;
