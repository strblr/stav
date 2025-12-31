import { create, EqualFn, type State, type Store } from "../create.js";
import { type Assign, createScope } from "../utils.js";

export interface EntangleStore {
  untangle: () => void;
}

export interface EntangleOptions<S extends Store<any>, S2 extends Store<any>> {
  with: S2;
  get?: (sourceState: State<S2>, state: State<S>) => State<S>;
  set?: (state: State<S>, sourceState: State<S2>) => State<S2>;
}

export function entangle<S extends Store<any>, S2 extends Store<any>>(
  store: S,
  options: EntangleOptions<S, S2>
): Assign<S, EntangleStore> {
  const { with: sourceStore, get, set } = options;
  const syncing = createScope(false);
  const unsubscribes: (() => void)[] = [];

  const entangleStore: EntangleStore = {
    untangle: () => {
      unsubscribes.forEach(f => f());
    }
  };

  if (get) {
    const hydrate = () => {
      store.set(() => get(sourceStore.get(), store.get()));
    };

    hydrate();

    unsubscribes.push(
      sourceStore.subscribe(() => {
        if (syncing.get()) return;
        syncing.act(true, hydrate);
      }, true)
    );
  }

  if (set) {
    unsubscribes.push(
      store.subscribe(state => {
        if (syncing.get()) return;
        syncing.act(true, () =>
          sourceStore.set(() => set(state, sourceStore.get()))
        );
      }, true)
    );
  }

  return Object.assign(store, entangleStore);
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
