import type { State, Store } from "../create";
import { assign, createScope } from "../utils.js";

export interface EntangleStore {
  untangle: () => void;
}

export interface EntangleOptions<S extends Store<any>, S2 extends Store<any>> {
  with: S2;
  get: (pairedState: State<S2>, state: State<S>) => State<S>;
  set: (state: State<S>, pairedState: State<S2>) => State<S2>;
}

export function entangle<S extends Store<any>, S2 extends Store<any>>(
  store: S,
  options: EntangleOptions<S, S2>
) {
  const { with: pairedStore, get, set } = options;
  const syncing = createScope(false);

  const syncIn = () => {
    store.set(get(pairedStore.get(), store.get()));
  };

  const syncOut = () => {
    pairedStore.set(set(store.get(), pairedStore.get()));
  };

  syncIn();

  const unsubscribeIn = pairedStore.subscribe(() => {
    !syncing.get() && syncing.act(true, syncIn);
  }, true);

  const unsubscribeOut = store.subscribe(() => {
    !syncing.get() && syncing.act(true, syncOut);
  }, true);

  return assign<S, EntangleStore>(store, {
    untangle: () => {
      unsubscribeIn();
      unsubscribeOut();
    }
  });
}
