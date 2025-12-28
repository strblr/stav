import { create, EqualFn, type State, type Store } from "../create.js";
import { assign, createScope } from "../utils.js";

export interface EntangleStore {
  untangle: () => void;
}

export interface EntangleOptions<S extends Store<any>, S2 extends Store<any>> {
  with: S2;
  get: (sourceState: State<S2>, state: State<S>) => State<S>;
  set?: (state: State<S>, sourceState: State<S2>) => State<S2>;
}

export function entangle<S extends Store<any>, S2 extends Store<any>>(
  store: S,
  options: EntangleOptions<S, S2>
) {
  const { with: sourceStore, get, set } = options;
  const { set: storeSet } = store;
  const syncing = createScope(false);
  const unsubscribes: (() => void)[] = [];

  const hydrate = () => {
    storeSet(() => get(sourceStore.get(), store.get()));
  };

  hydrate();

  unsubscribes.push(
    sourceStore.subscribe(() => {
      if (syncing.get()) return;
      syncing.act(true, hydrate);
    }, true)
  );

  if (!set) {
    store.set = () => {
      console.warn(
        "[stav/entangle] Calling set on a read-only derived store is a no-op, provide a set option to make it writable"
      );
    };
  } else {
    unsubscribes.push(
      store.subscribe(state => {
        if (syncing.get()) return;
        syncing.act(true, () =>
          sourceStore.set(() => set(state, sourceStore.get()))
        );
      }, true)
    );
  }

  return assign<S, EntangleStore>(store, {
    untangle: () => {
      unsubscribes.forEach(f => f());
    }
  });
}

// derive

export interface DeriveOptions<S extends Store<any>, U> {
  get: (sourceState: State<S>) => U;
  set?: (state: U, sourceState: State<S>) => State<S>;
}

export function derive<S extends Store<any>, U>(
  store: S,
  options: DeriveOptions<S, U>,
  equalFn?: EqualFn<U>
) {
  const derivedStore = create(undefined as U, {}, equalFn);
  return entangle(derivedStore, { with: store, ...options });
}
