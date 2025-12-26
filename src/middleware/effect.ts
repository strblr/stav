import type { State, Store } from "../create";

export function effect<S extends Store<any>>(
  store: S,
  effect: StoreEffect<State<S>>
) {
  const { set } = store;
  store.set = (...args) => {
    const previousState = store.get();
    set(...args);
    const state = store.get();
    if (!Object.is(previousState, state)) {
      effect(state, previousState);
    }
  };
  return store;
}

// Utils

export type StoreEffect<T> = (state: T, previousState: T) => void;
