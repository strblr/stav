import type { Store, StoreListener } from "./create";
import { getTransaction } from "./transaction.js";

export interface Internals<T> {
  state: T;
  listeners: Set<StoreListener<T>>;
}

export function getTransactionInternals<T>(store: Store<any>) {
  const currentTx = getTransaction();
  if (!currentTx) {
    return null;
  }
  let fork = currentTx.forks.get(store);
  if (!fork) {
    fork = {
      state: store.get(),
      listeners: new Set()
    };
    currentTx.forks.set(store, fork);
  }
  return fork as Internals<T>;
}
