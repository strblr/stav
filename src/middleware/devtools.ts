import "@redux-devtools/extension";
import type { Config } from "@redux-devtools/extension";
import type { State, Store, StoreUpdater } from "../create";
import { getTransaction } from "../transaction.js";
import { assign } from "../utils.js";

export interface DevtoolsStore<T> {
  devtools: {
    cleanup: () => void;
  };
  set: (
    nextState: StoreUpdater<T>,
    action?: string,
    data?: Record<string, any>
  ) => void;
}

export interface DevtoolsOptions extends Config {
  enabled?: boolean;
  defaultActionType?: string;
}

export function devtools<S extends Store<any>>(
  store: S,
  {
    enabled = true,
    defaultActionType = "anonymous",
    ...options
  }: DevtoolsOptions = {}
) {
  let recording = true;
  const { set } = store;
  const connection = connect(options, enabled);

  const passiveSet = (nextState: StoreUpdater<any>) => {
    const saved = recording;
    recording = false;
    store.set(nextState);
    recording = saved;
  };

  connection?.init(store.get());

  connection?.subscribe?.(message => {
    switch (message.type) {
      case "DISPATCH":
        switch (message.payload.type) {
          case "RESET":
            passiveSet(store.getInitial);
            connection.init(store.get());
            return;

          case "COMMIT":
            connection.init(store.get());
            return;

          case "ROLLBACK":
            passiveSet(() => JSON.parse(message.state));
            connection.init(store.get());
            return;

          case "JUMP_TO_STATE":
          case "JUMP_TO_ACTION":
            passiveSet(() => JSON.parse(message.state));
            return;

          case "PAUSE_RECORDING":
            recording = !recording;
            return;
        }
    }
  });

  return assign<S, DevtoolsStore<State<S>>>(store, {
    devtools: {
      cleanup: () => {
        recording = false;
        connection?.unsubscribe?.();
      }
    },
    set: (nextState, action = defaultActionType, data) => {
      set(nextState);
      if (!getTransaction() && recording) {
        connection?.send({ type: action, ...data }, store.get());
      }
    }
  });
}

// Utils

function connect(options: Config, enabled: boolean) {
  if (
    !enabled ||
    typeof window === "undefined" ||
    !window.__REDUX_DEVTOOLS_EXTENSION__
  ) {
    return;
  }
  const connection = window.__REDUX_DEVTOOLS_EXTENSION__.connect(options);
  return connection as typeof connection & {
    subscribe?: (
      listener: (message: DevtoolsMessage) => void
    ) => (() => void) | undefined;
    unsubscribe?: () => void;
  };
}

interface DevtoolsMessage {
  type: string;
  payload?: any;
  state?: any;
}
