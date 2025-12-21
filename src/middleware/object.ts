import type { Store, State, StoreUpdater } from "../create";
import { assign, shallow } from "../utils.js";

export interface ObjectStore<T> {
  assign: (...nextStates: StoreUpdater<T, Partial<T>>[]) => void;
}

export function object<S extends Store<any>>(store: S) {
  type T = State<S>;
  return assign<S, ObjectStore<T>>(store, {
    assign: (...nextStates) => {
      const state = store.get();
      let merged = state;
      for (const nextState of nextStates) {
        const changes =
          typeof nextState === "function"
            ? (nextState as (state: T) => T | Partial<T>)(merged)
            : nextState;
        merged = { ...merged, ...changes };
      }
      if (!shallow(merged, state)) {
        store.set(() => merged);
      }
    }
  });
}
