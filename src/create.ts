import { getInternals, type Internals } from "./internals.js";
import { type Assign } from "./utils.js";

export interface Store<T> {
  get: {
    (): T;
    initial: () => T;
  };
  set: (nextState: StoreUpdater<T>) => void;
  subscribe: (listener: StoreListener<T>, inherit?: boolean) => () => void;
}

export function create<T, H extends object = {}>(
  initialState: T,
  handlers = {} as H,
  equalFn: EqualFn<T> = Object.is
): Assign<Store<T>, H> {
  const internals: Internals<T> = {
    state: initialState,
    listeners: new Map()
  };

  const store: Store<T> = {
    get: Object.assign(() => getInternals(store, internals).state, {
      initial: () => initialState
    }),
    set: nextState => {
      const current = getInternals(store, internals);
      const { state, listeners } = current;
      nextState =
        typeof nextState === "function"
          ? (nextState as (state: T) => T)(state)
          : nextState;
      if (equalFn(state, nextState)) return;
      current.state = nextState;
      for (const listener of listeners.keys()) {
        listener(nextState, state);
      }
    },
    subscribe: (listener, inherit = false) => {
      const { listeners } = getInternals(store, internals);
      listeners.set(listener, inherit);
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
