import type { State, Store } from "../create";
import { create } from "./object.js";
import { assign, createScope } from "../utils.js";

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
  diff?: (state: T, nextState: T) => D | typeof unchanged;
  patch?: (state: T, delta: D) => T;
}

export function history<S extends Store<any>, D = State<S>>(
  store: S,
  options: HistoryOptions<State<S>, D> = {}
) {
  const {
    limit = Infinity,
    diff = (_, nextState) => nextState as D,
    patch = (_, delta) => delta as State<S>
  } = options;
  const tracking = createScope(true);

  const history = create(
    {
      tracking: true,
      past: [] as D[],
      future: [] as D[]
    },
    {
      undo: () => {
        const {
          past: [delta, ...past]
        } = history.get();
        if (!delta) return;
        const state = store.get();
        const nextState = patch(state, delta);
        const futureDelta = diff(nextState, state);
        tracking.act(false, () => store.set(nextState));
        history.assign(({ future }) => ({
          past,
          future: futureDelta !== unchanged ? [futureDelta, ...future] : future
        }));
      },
      redo: () => {
        const {
          future: [delta, ...future]
        } = history.get();
        if (!delta) return;
        const state = store.get();
        const nextState = patch(state, delta);
        const pastDelta = diff(nextState, state);
        tracking.act(false, () => store.set(nextState));
        history.assign(({ past }) => ({
          past: pastDelta !== unchanged ? [pastDelta, ...past] : past,
          future
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
  );

  const { set } = store;

  store.set = (...args) => {
    const previousState = store.get();
    set(...args);
    if (!tracking.get() || !history.get().tracking) {
      return;
    }
    const state = store.get();
    const delta = diff(state, previousState);
    if (delta === unchanged) return;
    history.assign(({ past }) => ({
      past: [delta, ...past].slice(0, limit),
      future: []
    }));
  };

  return assign<S, HistoryStore<D>>(store, { history });
}

// Utils

export const unchanged = Symbol("unchanged");
