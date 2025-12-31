import type { State, Store } from "../create.js";
import { create } from "./object.js";
import { txConfig } from "../transaction.js";
import { type Assign, createScope } from "../utils.js";

export interface HistoryStore<D> {
  history: ReturnType<
    typeof create<
      {
        tracking: boolean;
        past: D[];
        future: D[];
      },
      {
        undo: () => void;
        redo: () => void;
        clear: () => void;
        startTracking: () => void;
        stopTracking: () => void;
      }
    >
  >;
}

export interface HistoryOptions<T, D = T> {
  limit?: number;
  diff?: (state: T, targetState: T) => D | typeof unchanged;
  patch?: (state: T, delta: D) => T;
}

export function history<S extends Store<any>, D = State<S>>(
  store: S,
  options: HistoryOptions<State<S>, D> = {}
): Assign<S, HistoryStore<D>> {
  const {
    limit = Infinity,
    diff = (_, targetState) => targetState as D,
    patch = (_, delta) => delta as State<S>
  } = options;

  const tracking = createScope(true);

  const history = txConfig(
    create(
      {
        tracking: true,
        past: [] as D[],
        future: [] as D[]
      },
      {
        undo: () => {
          const { past } = history.get();
          if (past.length === 0) return;
          const [delta, ...rest] = past;
          const state = store.get();
          const nextState = patch(state, delta);
          const futureDelta = diff(nextState, state);
          tracking.act(false, () => store.set(nextState));
          history.assign(({ future }) => ({
            past: rest,
            future:
              futureDelta !== unchanged ? [futureDelta, ...future] : future
          }));
        },
        redo: () => {
          const { future } = history.get();
          if (future.length === 0) return;
          const [delta, ...rest] = future;
          const state = store.get();
          const nextState = patch(state, delta);
          const pastDelta = diff(nextState, state);
          tracking.act(false, () => store.set(nextState));
          history.assign(({ past }) => ({
            past: pastDelta !== unchanged ? [pastDelta, ...past] : past,
            future: rest
          }));
        },
        clear: () => {
          history.assign({ past: [], future: [] });
        },
        startTracking: () => {
          history.assign({ tracking: true });
        },
        stopTracking: () => {
          history.assign({ tracking: false });
        }
      }
    ),
    { commit: false }
  );

  const historyStore: HistoryStore<D> = { history };

  store.subscribe((state, previousState) => {
    if (!tracking.get() || !history.get().tracking) {
      return;
    }
    const delta = diff(state, previousState);
    if (delta === unchanged) return;
    history.assign(({ past }) => ({
      past: [delta, ...past].slice(0, limit),
      future: []
    }));
  }, true);

  return Object.assign(store, historyStore);
}

// Utils

export const unchanged = Symbol("unchanged");
