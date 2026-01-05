import type { Store } from "../create.js";
import { create } from "./object.js";
import type { Assign } from "../utils.js";

export interface LockStore {
  lock: ReturnType<
    typeof create<
      { locked: boolean },
      {
        lock: () => void;
        unlock: () => void;
        toggle: () => void;
      }
    >
  >;
}

export function lock<S extends Store<any>>(store: S): Assign<S, LockStore> {
  const { set } = store;

  const lock = create(
    { locked: false },
    {
      lock: () => lock.assign({ locked: true }),
      unlock: () => lock.assign({ locked: false }),
      toggle: () => lock.assign(({ locked }) => ({ locked: !locked }))
    }
  );

  const lockStore: LockStore = { lock };

  store.set = (...args) => {
    if (lock.get().locked) return;
    set(...args);
  };

  return Object.assign(store, lockStore);
}
