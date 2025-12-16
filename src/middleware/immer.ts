import { produce, type Draft, type nothing } from "immer";
import type { Assign, BaseStore, State } from "../create";

export interface ImmerStore<T> {
  set: (nextState: T | ImmerRecipe<T>) => void;
}

export interface ImmerRecipe<T> {
  (state: Draft<T>): T | void | (undefined extends T ? typeof nothing : never);
}

export function immer<S extends BaseStore<any>>(
  store: S
): Assign<S, ImmerStore<State<S>>> {
  type T = State<S>;

  const immerStore: ImmerStore<T> = {
    set: nextState => {
      const updater =
        typeof nextState === "function"
          ? (produce(nextState) as (state: T) => T)
          : nextState;
      store.set(updater);
    }
  };

  return { ...store, ...immerStore };
}
