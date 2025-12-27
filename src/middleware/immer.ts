import { produce, type Draft, type nothing } from "immer";
import type { Store, State } from "../create";
import { assign } from "../utils.js";

export interface ImmerStore<T> {
  produce: (nextState: T | ImmerRecipe<T>) => boolean;
}

export interface ImmerRecipe<T> {
  (state: Draft<T>): T | void | (undefined extends T ? typeof nothing : never);
}

export function immer<S extends Store<any>>(store: S) {
  return assign<S, ImmerStore<State<S>>>(store, {
    produce: nextState => {
      const updater =
        typeof nextState === "function" ? produce(nextState) : nextState;
      return store.set(updater);
    }
  });
}
