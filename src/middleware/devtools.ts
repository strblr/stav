import "@redux-devtools/extension";
import type { Config } from "@redux-devtools/extension";
import type { State, Store, StoreUpdater } from "../create";
import { getTransaction } from "../transaction.js";
import { assign, createScope } from "../utils.js";

export interface DevtoolsStore<T> {
  devtools: {
    cleanup: () => void;
  };
  set: (
    nextState: StoreUpdater<T>,
    action?: string,
    data?: Record<string, any>
  ) => boolean;
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
  const connection = connect(options, enabled);
  const recording = createScope(true);
  const { set } = store;

  connection?.init(store.get());

  connection?.subscribe?.(message => {
    switch (message.type) {
      case "DISPATCH":
        switch (message.payload.type) {
          case "RESET":
            recording.act(false, () => {
              store.set(store.getInitial);
            });
            connection.init(store.get());
            return;

          case "COMMIT":
            connection.init(store.get());
            return;

          case "ROLLBACK":
            recording.act(false, () => {
              store.set(() => JSON.parse(message.state));
            });
            connection.init(store.get());
            return;

          case "JUMP_TO_STATE":
          case "JUMP_TO_ACTION":
            recording.act(false, () =>
              store.set(() => JSON.parse(message.state))
            );
            return;

          case "PAUSE_RECORDING":
            recording.set(!recording.get());
            return;
        }
    }
  });

  return assign<S, DevtoolsStore<State<S>>>(store, {
    devtools: {
      cleanup: () => {
        recording.set(false);
        connection?.unsubscribe?.();
      }
    },
    set: (nextState, action = defaultActionType, data) => {
      const changed = set(nextState);
      if (!getTransaction() && recording.get()) {
        connection?.send({ type: action, ...data }, store.get());
      }
      return changed;
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
