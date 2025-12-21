import {
  create as vanilla,
  type Store,
  type State,
  type StoreUpdater,
  type EqualFn
} from "../create.js";
import { type Assign, assign, shallow } from "../utils.js";

export interface ObjectStore<T> {
  assign: (...nextStates: StoreUpdater<T, Partial<T>>[]) => void;
}

export function object<S extends Store<any>>(store: S) {
  type T = State<S>;
  return assign<S, ObjectStore<T>>(store, {
    assign: (...nextStates) => {
      const state = store.get();
      let merged = state;
      for (const nextState of nextStates) {
        const changes =
          typeof nextState === "function"
            ? (nextState as (state: T) => T | Partial<T>)(merged)
            : nextState;
        merged = { ...merged, ...changes };
      }
      store.set(() => merged);
    }
  });
}

// create

export function create<T, H extends object = {}>(
  initialState: T,
  handlers?: H,
  equalFn: EqualFn<T> = shallow
) {
  const store = vanilla(initialState, handlers, equalFn);
  return object(store as any) as Assign<typeof store, ObjectStore<T>>;
}
