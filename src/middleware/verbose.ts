import type { Store } from "../create";

export interface VerboseOptions {
  label?: string;
  enabled?: boolean;
  onSet?: boolean;
  onSubscribe?: boolean;
  onListener?: boolean;
  onUnsubscribe?: boolean;
  logger?: (...parts: any[]) => void;
}

export function verbose<S extends Store<any>>(
  store: S,
  options: VerboseOptions = {}
) {
  const {
    label = "store-" + counter++,
    enabled = true,
    onSet = true,
    onSubscribe = true,
    onListener = true,
    onUnsubscribe = true,
    logger = console.log
  } = options;

  const { set, subscribe } = store;

  if (!enabled) {
    return store;
  }

  const log = (enabled: boolean, ...parts: any[]) => {
    if (!enabled) return;
    logger(`[stav/${label}]`, ...parts);
  };

  store.set = (...args) => {
    const id = String(counter++);
    log(onSet, "set:before", id, store.get());
    set(...args);
    log(onSet, "set:after", id, store.get());
  };

  store.subscribe = (listener, inherit) => {
    const id = String(counter++);
    log(onSubscribe, "subscribe", id, listener);
    const unsubscribe = subscribe((state, previousState) => {
      const id = String(counter++);
      log(onListener, "listener:before", id, { state, previousState });
      listener(state, previousState);
      log(onListener, "listener:after", id);
    }, inherit);
    return () => {
      log(onUnsubscribe, "unsubscribe", id);
      unsubscribe();
    };
  };

  return store;
}

// Utils

let counter = 0;
