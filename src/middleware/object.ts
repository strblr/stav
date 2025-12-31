import {
  create as vanilla,
  type Store,
  type State,
  type EqualFn
} from "../create.js";
import { type Assign, shallow } from "../utils.js";

export interface ObjectStore<T> {
  assign: (...nextStates: AssignUpdater<T>[]) => void;
}

export function object<S extends Store<any>>(
  store: S
): Assign<S, ObjectStore<State<S>>> {
  type T = State<S>;

  const objectStore: ObjectStore<T> = {
    assign: (...nextStates) => {
      const state = nextStates.reduce((state, nextState) => {
        const partial =
          typeof nextState === "function"
            ? (nextState as (state: T) => T | Partial<T>)(state)
            : nextState;
        return { ...state, ...partial };
      }, store.get());
      store.set(() => state);
    }
  };

  return Object.assign(store, objectStore);
}

// create

export function create<T extends object, H extends object = {}>(
  initialState: T,
  handlers?: H,
  equalFn: EqualFn<T> = shallow
) {
  const store = vanilla(initialState, handlers, equalFn);
  return object(store as any) as Assign<Assign<Store<T>, H>, ObjectStore<T>>;
}

// Utils

export type AssignUpdater<T> = T | Partial<T> | ((state: T) => T | Partial<T>);
