import { produce, type Draft, type nothing } from "immer";
import type { Store, State } from "../create.js";
import type { Assign } from "../utils.js";

export interface ImmerStore<T> {
  produce: (nextState: T | ImmerRecipe<T>) => void;
}

export interface ImmerRecipe<T> {
  (state: Draft<T>): T | void | (undefined extends T ? typeof nothing : never);
}

export function immer<S extends Store<any>>(
  store: S
): Assign<S, ImmerStore<State<S>>> {
  const immerStore: ImmerStore<State<S>> = {
    produce: nextState => {
      const updater =
        typeof nextState === "function" ? produce(nextState) : nextState;
      store.set(updater);
    }
  };
  return Object.assign(store, immerStore);
}
