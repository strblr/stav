import type { Store, State } from "../create";
import { type Assign, assign } from "../utils.js";

export interface ReduxStore<A> {
  dispatch: (action: A) => void;
}

export interface Reducer<T, A> {
  (state: T, action: A): T;
}

export function redux<S extends Store<any>, A extends { type: string }>(
  store: S,
  reducer: Reducer<State<S>, A>
): Assign<S, ReduxStore<A>> {
  return assign<S, ReduxStore<A>>(store, {
    dispatch: action => store.set(() => reducer(store.get(), action))
  });
}
