import type { Store } from "./create.js";
import { createScope } from "./utils.js";

interface Transaction {
  parent: Transaction | null;
  checkpoint: Map<Store<any>, any>;
}

const scope = createScope<Transaction | null>(null);
const ignoretx = Symbol("ignoretx");

export function transaction<T>(fn: (act: <U>(fn: () => U) => U) => T): T {
  const tx: Transaction = {
    parent: scope.get(),
    checkpoint: new Map()
  };
  const act = <U>(fn: () => U) => scope.act(tx, fn);
  const revert = () => {
    scope.act(tx.parent, () => {
      for (const [store, state] of tx.checkpoint) {
        store.set(state);
      }
    });
  };
  try {
    const result = act(() => fn(act));
    if (result instanceof Promise) {
      return result.catch(error => {
        revert();
        throw error;
      }) as T;
    }
    return result;
  } catch (error) {
    revert();
    throw error;
  }
}

export function notifyCheckpoint(store: Store<any>) {
  if (Object.hasOwn(store, ignoretx)) {
    return;
  }
  for (let tx = scope.get(); tx && !tx.checkpoint.has(store); tx = tx.parent) {
    tx.checkpoint.set(store, store.get());
  }
}

export function txIgnore<S extends Store<any>>(store: S) {
  Object.assign(store, { [ignoretx]: true });
  return store;
}
