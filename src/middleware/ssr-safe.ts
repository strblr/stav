import type { Store } from "../create";

export interface SSRSafeOptions {
  isSSR?: boolean;
}

export function ssrSafe<S extends Store<any>>(
  store: S,
  options: SSRSafeOptions = {}
) {
  const { isSSR = typeof window === "undefined" } = options;

  if (isSSR) {
    store.set = () => {
      throw new Error("Cannot call set() of stav store in SSR");
    };
  }

  return store;
}
