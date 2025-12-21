import { getTransactionInternals, type Internals } from "./internals.js";

export interface Store<T> {
  get: () => T;
  getInitial: () => T;
  set: (nextState: StoreUpdater<T>) => void;
  subscribe: (listener: StoreListener<T>) => () => void;
}

export function create<T, H extends object = {}>(
  initialState: T,
  handlers?: H
): Assign<Store<T>, H> {
  const internals: Internals<T> = {
    state: initialState,
    listeners: new Set()
  };

  const getInternals = () => {
    return getTransactionInternals<T>(store) ?? internals;
  };

  const store: Store<T> = {
    get: () => getInternals().state,
    getInitial: () => initialState,
    set: nextState => {
      const internals = getInternals();
      const { state, listeners } = internals;
      nextState =
        typeof nextState === "function"
          ? (nextState as (state: T) => T)(state)
          : nextState;
      if (Object.is(nextState, state)) return;
      internals.state = nextState;
      listeners.forEach(listener => listener(nextState, state));
    },
    subscribe: listener => {
      const { listeners } = getInternals();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };

  return Object.assign(store, handlers);
}

// Utils

export type StoreUpdater<T, U = T> = T | U | ((state: T) => T | U);

export type StoreListener<T> = (state: T, previousState: T) => void;

export type State<S extends Store<any>> = ReturnType<S["get"]>;

export type EqualFn<T> = (state: T, nextState: T) => boolean;

export type Assign<T, U> = Pretty<Omit<T, keyof U> & U>;

type Pretty<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>;
