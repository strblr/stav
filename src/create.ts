export interface BaseStore<T> {
  get: () => T;
  getInitial: () => T;
  set: (nextState: T | ((state: T) => T)) => void;
  subscribe: (listener: ChangeListener<T>) => () => void;
}

export interface Create {
  <T>(initialState: T): Assign<BaseStore<T>, {}>;
  <T, H extends object>(initialState: T, handlers: H): Assign<BaseStore<T>, H>;
}

export const create: Create = <T, H extends object>(
  initialState: T,
  handlers?: H
) => {
  let state = initialState;
  const listeners = new Set<ChangeListener<T>>();

  const store: BaseStore<T> = {
    get: () => state,
    getInitial: () => initialState,
    set: nextState => {
      nextState =
        typeof nextState === "function"
          ? (nextState as (state: T) => T)(state)
          : nextState;
      if (Object.is(nextState, state)) return;
      const previousState = state;
      state = nextState;
      listeners.forEach(listener => listener(state, previousState));
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };

  return { ...store, ...handlers };
};

// Utils

export type ChangeListener<T> = (state: T, previousState: T) => void;

export type State<S extends BaseStore<any>> =
  S extends BaseStore<infer T> ? T : never;

export type Assign<T, U> = Pretty<Omit<T, keyof U> & U>;

type Pretty<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>;
