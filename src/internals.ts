import type { Store, StoreListener } from "./create";
import { getTransaction, type Transaction } from "./transaction.js";

export interface Internals<T> {
  state: T;
  readonly listeners: Set<StoreListener<T>>;
}

export function getInternals<T>(store: Store<T>, internals: Internals<T>) {
  return upsertInternals(getTransaction(), store, internals);
}

function upsertInternals<T>(
  tx: Transaction | null,
  store: Store<T>,
  internals: Internals<T>
): Internals<T> {
  if (!tx) {
    return internals;
  }
  let fork = tx.forks.get(store);
  if (!fork) {
    fork = {
      state: upsertInternals(tx.parent, store, internals).state,
      listeners: new Set()
    };
    tx.forks.set(store, fork);
  }
  return fork;
}
