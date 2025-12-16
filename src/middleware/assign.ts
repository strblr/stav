import type { Assign, BaseStore, State } from "../create";
import { shallow } from "../utils.js";

export interface AssignStore<T> {
  set: (nextState: T | Partial<T> | ((state: T) => T | Partial<T>)) => void;
}

export function assign<S extends BaseStore<any>>(
  store: S
): Assign<S, AssignStore<State<S>>> {
  type T = State<S>;

  const assignStore: AssignStore<T> = {
    set: nextState => {
      const state = store.get();
      nextState =
        typeof nextState === "function"
          ? (nextState as (state: T) => T | Partial<T>)(state)
          : nextState;
      const mergedState = { ...state, ...nextState };
      if (!shallow(mergedState, state)) {
        store.set(mergedState);
      }
    }
  };

  return { ...store, ...assignStore };
}
