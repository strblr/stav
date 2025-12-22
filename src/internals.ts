import type { Store, StoreListener } from "./create";
import { getTransaction } from "./transaction.js";

export interface Internals<T> {
  state: T;
  listeners: Set<StoreListener<T>>;
}

export function getInternals<T>(store: Store<T>, internals: Internals<T>) {
  const currentTx = getTransaction();
  if (!currentTx) {
    return internals;
  }
  let fork = currentTx.forks.get(store);
  if (!fork) {
    fork = {
      state: internals.state,
      listeners: new Set()
    };
    currentTx.forks.set(store, fork);
  }
  return fork as Internals<T>;
}
