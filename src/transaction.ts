import type { Store } from "./create.js";
import { nocommit, nofork, type Internals } from "./internals.js";
import { createScope } from "./utils.js";

export interface Transaction {
  readonly parent: Transaction | null;
  readonly forks: Map<Store<any>, Internals<any>>;
  act: <T>(fn: () => T) => T;
  commit: () => void;
}

const scope = createScope<Transaction | null>(null);

export function getTransaction() {
  return scope.get();
}

export function createTransaction(parent = getTransaction()) {
  const tx: Transaction = {
    parent,
    forks: new Map(),
    act: fn => scope.act(tx, fn),
    commit: () => {
      scope.act(parent, () => {
        tx.forks.forEach((internals, store) => {
          if (!Object.hasOwn(store, nocommit)) {
            store.set(() => internals.state);
          }
        });
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

export function txConfig<S extends Store<any>>(
  store: S,
  options: { fork?: boolean; commit?: boolean }
) {
  const { fork = true, commit = true } = options;
  if (!fork) {
    Object.assign(store, { [nofork]: true });
  }
  if (!commit) {
    Object.assign(store, { [nocommit]: true });
  }
  return store;
}
