import type { Store, StoreListener } from "./create";
import { getTransaction, nofork, type Transaction } from "./transaction.js";

export interface Internals<T> {
  state: T;
  readonly listeners: Map<StoreListener<T>, boolean>;
}

export function getInternals<T>(store: Store<T>, internals: Internals<T>) {
  return upsertInternals(getTransaction(), store, internals);
}

function upsertInternals<T>(
  tx: Transaction | null,
  store: Store<T>,
  internals: Internals<T>
): Internals<T> {
  if (!tx || Object.hasOwn(store, nofork)) {
    return internals;
  }
  let fork = tx.forks.get(store);
  if (!fork) {
    const parentInternals = upsertInternals(tx.parent, store, internals);
    fork = {
      state: parentInternals.state,
      listeners: new Map(
        [...parentInternals.listeners].filter(([_, inherit]) => inherit)
      )
    };
    tx.forks.set(store, fork);
  }
  return fork;
}
