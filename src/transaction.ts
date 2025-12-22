import type { Store } from "./create";
import type { Internals } from "./internals";

export interface Transaction {
  parent: Transaction | null;
  forks: Map<Store<any>, Internals<any>>;
  act: <T>(fn: () => T) => T;
  commit: () => void;
}

let currentTx: Transaction | null = null;

export function getTransaction() {
  return currentTx;
}

export function createTransaction() {
  const tx: Transaction = {
    parent: currentTx,
    forks: new Map(),
    act: fn => {
      const saved = currentTx;
      currentTx = tx;
      const result = fn();
      currentTx = saved;
      return result;
    },
    commit: () => {
      tx.forks.forEach((internals, store) => store.set(() => internals.state));
    }
  };
  return tx;
}

export function transaction<T>(fn: (act: Transaction["act"]) => T): T {
  const tx = createTransaction();
  const result = tx.act(() => fn(tx.act));
  if (!(result instanceof Promise)) {
    tx.commit();
    return result;
  } else {
    return result.then(result => {
      tx.commit();
      return result;
    }) as T;
  }
}
