import type { Store, State } from "../create.js";
import type { Assign } from "../utils.js";

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
  const reduxStore: ReduxStore<A> = {
    dispatch: action => store.set(() => reducer(store.get(), action))
  };
  return Object.assign(store, reduxStore);
}
