import type { Store, State } from "../create";
import { assign } from "../utils.js";

export interface ReduxStore<A> {
  dispatch: (action: A) => boolean;
}

export interface Reducer<T, A> {
  (state: T, action: A): T;
}

export function redux<S extends Store<any>, A extends { type: string }>(
  store: S,
  reducer: Reducer<State<S>, A>
) {
  return assign<S, ReduxStore<A>>(store, {
    dispatch: action => store.set(() => reducer(store.get(), action))
  });
}
