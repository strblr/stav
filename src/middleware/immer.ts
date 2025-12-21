import { produce, type Draft, type nothing } from "immer";
import type { Assign, Store, State } from "../create";

export interface ImmerStore<T> {
  produce: (nextState: T | ImmerRecipe<T>) => void;
}

export interface ImmerRecipe<T> {
  (state: Draft<T>): T | void | (undefined extends T ? typeof nothing : never);
}

export function immer<S extends Store<any>>(
  store: S
): Assign<S, ImmerStore<State<S>>> {
  type T = State<S>;

  const immerStore: ImmerStore<T> = {
    produce: nextState => {
      const updater =
        typeof nextState === "function" ? produce(nextState) : nextState;
      store.set(updater);
    }
  };

  return Object.assign(store, immerStore);
}
 