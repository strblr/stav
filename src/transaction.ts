import type { Store } from "./create";
import type { Internals } from "./internals";

export interface Transaction {
  readonly parent: Transaction | null;
  readonly forks: Map<Store<any>, Internals<any>>;
  act: <T>(fn: () => T) => T;
  commit: () => void;
}

let currentTx: Transaction | null = null;

export function getTransaction() {
  return currentTx;
}

export function createTransaction(parent = currentTx) {
  const act = <T>(tx: Transaction | null, fn: () => T) => {
    const saved = currentTx;
    try {
      currentTx = tx;
      return fn();
    } finally {
      currentTx = saved;
    }
  };
  const tx: Transaction = {
    parent,
    forks: new Map(),
    act: fn => act(tx, fn),
    commit: () => {
      act(parent, () => {
        tx.forks.forEach((internals, store) =>
          store.set(() => internals.state)
        );
      });
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
