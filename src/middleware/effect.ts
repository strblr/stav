import type { State, Store } from "../create";

export function effect<S extends Store<any>>(
  store: S,
  effect: StoreEffect<State<S>>
) {
  const { set } = store;
  store.set = (...args) => {
    const previousState = store.get();
    const changed = set(...args);
    changed && effect(store.get(), previousState);
    return changed;
  };
  return store;
}

// Utils

export type StoreEffect<T> = (state: T, previousState: T) => void;
