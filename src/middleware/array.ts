import {
  create as vanilla,
  type EqualFn,
  type State,
  type Store
} from "../create.js";
import { type Assign, assign } from "../utils.js";

export interface ArrayStore<T> {
  push: (...items: T[]) => void;
  unshift: (...items: T[]) => void;
  concat: (...arrays: T[][]) => void;
  filter: (predicate: ArrayCallback<T>) => void;
  map: (mapper: ArrayCallback<T, T>) => void;
  reverse: () => void;
  sort: (comparator?: (a: T, b: T) => number) => void;
  slice: (start?: number, end?: number) => void;
  with: (
    index: number | ArrayCallback<T>,
    value: T | ((value: T) => T)
  ) => void;
}

export function array<S extends Store<any[]>>(
  store: S
): Assign<S, ArrayStore<State<S>[number]>> {
  type T = State<S>[number];

  return assign<S, ArrayStore<T>>(store, {
    push: (...items) => {
      if (items.length > 0) {
        store.set(state => [...state, ...items]);
      }
    },
    unshift: (...items) => {
      if (items.length > 0) {
        store.set(state => [...items, ...state]);
      }
    },
    concat: (...arrays) => {
      if (arrays.length > 0) {
        store.set(state => state.concat(...arrays));
      }
    },
    filter: predicate => {
      store.set(state => state.filter(predicate));
    },
    map: mapper => {
      store.set(state => state.map(mapper));
    },
    reverse: () => {
      store.set(state => [...state].reverse());
    },
    sort: comparator => {
      store.set(state => [...state].sort(comparator));
    },
    slice: (start, end) => {
      store.set(state => state.slice(start, end));
    },
    with: (index, value) => {
      const state = store.get();
      if (typeof index === "function") {
        index = state.findIndex(index);
        if (index === -1) return;
      }
      if (typeof value === "function") {
        value = (value as (value: T) => T)(state.at(index));
      }
      store.set(state => state.with(index, value));
    }
  });
}

// create

export function create<T extends readonly any[], H extends object = {}>(
  initialState: T,
  handlers?: H,
  equalFn?: EqualFn<T>
) {
  const store = vanilla(initialState, handlers, equalFn);
  return array(store as any) as Assign<
    Assign<Store<T>, H>,
    ArrayStore<T[number]>
  >;
}

// Utils

export interface ArrayCallback<T, R = unknown> {
  (value: T, index: number, array: T[]): R;
}
