import type { Store } from "./create.js";

export function transaction<T>(fn: () => T, stores: Store<any>[]): T {
  const checkpoints = stores.map(store => store.get());
  const revert = () => {
    stores.forEach((store, index) => {
      store.set(checkpoints[index]);
    });
  };
  try {
    const result = fn();
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
