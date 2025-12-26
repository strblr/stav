import { test, expect, mock, describe } from "bun:test";
import * as jsondiffpatch from "jsondiffpatch";
import { create } from "../create";
import { history, unchanged } from "./history";
import { persist } from "./persist";
import { transaction } from "../transaction";
import { shallow } from "../utils";

describe("history middleware", () => {
  test("adds history property to store", () => {
    const store = history(create({ count: 0 }));

    expect(store.history).toBeDefined();
    expect(store.history.get).toBeFunction();
    expect(store.history.undo).toBeFunction();
    expect(store.history.redo).toBeFunction();
    expect(store.history.clear).toBeFunction();
    expect(store.history.startTracking).toBeFunction();
    expect(store.history.stopTracking).toBeFunction();
  });

  test("initial history state", () => {
    const store = history(create({ count: 0 }));

    const historyState = store.history.get();
    expect(historyState.tracking).toBe(true);
    expect(historyState.past).toEqual([]);
    expect(historyState.future).toEqual([]);
  });

  test("preserves original store methods", () => {
    const store = history(create({ count: 0 }));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });
});

describe("undo/redo", () => {
  test("undo reverts to previous state", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    expect(store.get()).toEqual({ count: 2 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });
  });

  test("redo restores undone state", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });

    store.history.redo();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("multiple undo operations", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("multiple redo operations", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });

    store.history.undo();
    store.history.undo();
    store.history.undo();

    store.history.redo();
    expect(store.get()).toEqual({ count: 1 });

    store.history.redo();
    expect(store.get()).toEqual({ count: 2 });

    store.history.redo();
    expect(store.get()).toEqual({ count: 3 });
  });

  test("undo with no history does nothing", () => {
    const store = history(create({ count: 0 }));

    store.history.undo();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("redo with no future does nothing", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.history.redo();
    expect(store.get()).toEqual({ count: 1 });
  });

  test("new changes clear future history", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.history.undo();
    expect(store.history.get().future).toHaveLength(1);

    store.set({ count: 3 });
    expect(store.history.get().future).toEqual([]);
  });

  test("undo/redo does not trigger history tracking", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });

    const pastLength = store.history.get().past.length;

    store.history.undo();
    store.history.redo();
    expect(store.history.get().past.length).toBe(pastLength);
  });
});

describe("clear", () => {
  test("clear removes all history", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.history.undo();

    expect(store.history.get().past.length).toBe(1);
    expect(store.history.get().future.length).toBe(1);

    store.history.clear();
    expect(store.history.get().past).toEqual([]);
    expect(store.history.get().future).toEqual([]);
  });

  test("clear does not affect current state", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 5 });
    store.history.clear();
    expect(store.get()).toEqual({ count: 5 });
  });
});

describe("tracking control", () => {
  test("stopTracking prevents history recording", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    expect(store.history.get().past.length).toBe(1);

    store.history.stopTracking();
    store.set({ count: 2 });
    store.set({ count: 3 });
    expect(store.history.get().past.length).toBe(1);
  });

  test("startTracking resumes history recording", () => {
    const store = history(create({ count: 0 }));

    store.history.stopTracking();
    store.set({ count: 1 });
    expect(store.history.get().past.length).toBe(0);
    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });

    store.history.startTracking();
    store.set({ count: 2 });
    expect(store.history.get().past.length).toBe(1);

    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });
  });

  test("tracking state is reflected in history state", () => {
    const store = history(create({ count: 0 }));
    expect(store.history.get().tracking).toBe(true);

    store.history.stopTracking();
    expect(store.history.get().tracking).toBe(false);

    store.history.startTracking();
    expect(store.history.get().tracking).toBe(true);
  });
});

describe("limit option", () => {
  test("respects history limit", () => {
    const store = history(create({ count: 0 }), { limit: 3 });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });
    store.set({ count: 4 });
    store.set({ count: 5 });
    expect(store.history.get().past.length).toBe(3);

    store.history.undo();
    expect(store.get()).toEqual({ count: 4 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 3 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("limit of 1 keeps only last state", () => {
    const store = history(create({ count: 0 }), { limit: 1 });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });
    expect(store.history.get().past.length).toBe(1);

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("limit of 0 disables history", () => {
    const store = history(create({ count: 0 }), { limit: 0 });

    store.set({ count: 1 });
    store.set({ count: 2 });
    expect(store.history.get().past.length).toBe(0);

    store.history.undo();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("no limit allows unlimited history", () => {
    const store = history(create({ count: 0 }));

    for (let i = 1; i <= 500; i++) {
      store.set({ count: i });
    }
    expect(store.history.get().past.length).toBe(500);
  });
});

describe("custom diff/patch", () => {
  test("custom diff function is called", () => {
    const diffSpy = mock((_: any, targetState: any) => targetState);
    const store = history(create({ count: 0 }), { diff: diffSpy });

    store.set({ count: 1 });
    expect(diffSpy).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });

  test("custom patch function is called on undo", () => {
    const patchSpy = mock((_: any, delta: any) => delta);

    const store = history(create({ count: 0 }), {
      patch: patchSpy
    });

    store.set({ count: 1 });
    store.history.undo();
    expect(patchSpy).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });

  test("unchanged symbol prevents history recording", () => {
    const store = history(create({ count: 0, ignored: "test" }), {
      diff: (state, targetState) => {
        if (state.count === targetState.count) {
          return unchanged;
        }
        return targetState;
      }
    });

    store.set({ count: 0, ignored: "changed" });
    expect(store.history.get().past.length).toBe(0);

    store.set({ count: 1, ignored: "changed" });
    expect(store.history.get().past.length).toBe(1);
  });

  test("diff/patch for delta storage", () => {
    const differ = jsondiffpatch.create();
    const store = history(
      create({
        users: [
          { id: 1, name: "Alice", age: 30 },
          { id: 2, name: "Bob", age: 25 }
        ],
        settings: { theme: "light", notifications: true }
      }),
      {
        diff: (state, targetState) => {
          return differ.diff(state, targetState) ?? unchanged;
        },
        patch: (state, delta) => {
          const cloned = JSON.parse(JSON.stringify(state));
          return differ.patch(cloned, delta) as typeof state;
        }
      }
    );

    store.set(state => ({
      ...state,
      settings: { theme: "dark", notifications: true }
    }));

    store.set(state => ({
      ...state,
      users: [
        { id: 1, name: "Alice", age: 31 },
        { id: 2, name: "Bob", age: 25 }
      ]
    }));

    store.history.undo();
    expect(store.get().users[0].age).toBe(30);
    expect(store.get().settings.theme).toBe("dark");

    store.history.undo();
    expect(store.get().settings.theme).toBe("light");

    store.history.redo();
    expect(store.get().settings.theme).toBe("dark");

    store.history.redo();
    expect(store.get().users[0].age).toBe(31);
  });

  test("diff/patch with complex nested changes", () => {
    const differ = jsondiffpatch.create();
    const store = history(
      create({
        todos: [
          { id: 1, text: "Task 1", completed: false },
          { id: 2, text: "Task 2", completed: false }
        ]
      }),
      {
        diff: (state, targetState) => {
          return differ.diff(state, targetState) ?? unchanged;
        },
        patch: (state, delta) => {
          const cloned = JSON.parse(JSON.stringify(state));
          return differ.patch(cloned, delta) as typeof state;
        }
      }
    );

    store.set(({ todos }) => ({
      todos: [...todos, { id: 3, text: "Task 3", completed: false }]
    }));
    expect(store.get().todos.length).toBe(3);

    store.set(({ todos }) => ({
      todos: todos.map(t => (t.id === 2 ? { ...t, completed: true } : t))
    }));

    expect(store.get().todos[1].completed).toBe(true);

    store.history.undo();
    expect(store.get().todos[1].completed).toBe(false);
    expect(store.get().todos.length).toBe(3);

    store.history.undo();
    expect(store.get().todos.length).toBe(2);
  });
});

describe("edge cases", () => {
  test("works with primitive state", () => {
    const store = history(create(0));

    store.set(1);
    store.set(2);
    store.history.undo();
    expect(store.get()).toBe(1);

    store.history.redo();
    expect(store.get()).toBe(2);
  });

  test("works with array state", () => {
    const store = history(create([1, 2, 3]));

    store.set([1, 2, 3, 4]);
    store.set([1, 2, 3, 4, 5]);
    store.history.undo();
    expect(store.get()).toEqual([1, 2, 3, 4]);
  });

  test("works with null state", () => {
    const store = history(create<{ value: string } | null>({ value: "test" }));

    store.set(null);
    store.set({ value: "changed" });
    store.history.undo();
    expect(store.get()).toBe(null);
    store.history.undo();
    expect(store.get()).toEqual({ value: "test" });
  });

  test("works with undefined state", () => {
    const store = history(
      create<{ value: string } | undefined>({ value: "test" })
    );

    store.set(undefined);
    store.set({ value: "changed" });
    store.history.undo();
    expect(store.get()).toBe(undefined);
    store.history.undo();
    expect(store.get()).toEqual({ value: "test" });
  });

  test("multiple history instances on different stores", () => {
    const store1 = history(create({ count: 0 }));
    const store2 = history(create({ value: "a" }));

    store1.set({ count: 1 });
    store2.set({ value: "b" });

    store1.history.undo();
    expect(store1.get()).toEqual({ count: 0 });
    expect(store2.get()).toEqual({ value: "b" });

    store2.history.undo();
    expect(store1.get()).toEqual({ count: 0 });
    expect(store2.get()).toEqual({ value: "a" });
  });

  test("history with store that has custom handlers", () => {
    const store = history(
      create(
        { count: 0 },
        {
          increment: () => store.set(s => ({ count: s.count + 1 })),
          decrement: () => store.set(s => ({ count: s.count - 1 }))
        }
      )
    );

    store.increment();
    store.increment();
    expect(store.get()).toEqual({ count: 2 });

    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });
  });

  test("subscribers are notified on undo/redo", () => {
    const store = history(create({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 1 });
    listener.mockClear();

    store.history.undo();
    expect(listener).toHaveBeenCalledWith({ count: 0 }, { count: 1 });

    listener.mockClear();
    store.history.redo();
    expect(listener).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });

  test("rapid state changes", () => {
    const store = history(create({ count: 0 }), { limit: 10 });

    for (let i = 1; i <= 20; i++) {
      store.set({ count: i });
    }
    expect(store.history.get().past.length).toBe(10);

    for (let i = 1; i <= 20; i++) {
      store.history.undo();
    }
    expect(store.get()).toEqual({ count: 10 });
  });

  test("undo/redo alternation", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });

    for (let i = 0; i < 20; i++) {
      store.history.undo();
      store.history.redo();
    }
    expect(store.get()).toEqual({ count: 2 });
  });

  test("history state updates are tracked", () => {
    const store = history(create({ count: 0 }));
    const historyListener = mock();

    store.history.subscribe(historyListener);

    store.set({ count: 1 });
    expect(historyListener).toHaveBeenCalled();
  });

  test("idempotent set calls don't trigger history updates", () => {
    const store = history(create({ count: 0 }, {}, shallow));
    expect(store.history.get().past).toEqual([]);
    store.set({ count: 0 });
    expect(store.history.get().past).toEqual([]);
    store.set({ count: 0 });
    expect(store.history.get().past).toEqual([]);
    store.set({ count: 1 });
    expect(store.history.get().past).toEqual([{ count: 0 }]);
  });
});

describe("integration", () => {
  test("works with persist middleware", () => {
    const storage = createMockStorage();
    const store = persist(history(create({ count: 0 })), { storage });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.history.undo();
    expect(store.get()).toEqual({ count: 1 });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 1 }, 1])
    );

    store.history.redo();
    expect(store.get()).toEqual({ count: 2 });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 2 }, 1])
    );
  });

  test("works with persist middleware on main and history stores", () => {
    const storage = createMockStorage();
    const store = persist(history(create({ count: 0 })), { storage });
    const historyStore = persist(store.history, { storage, key: "history" });

    expect(store.history).toBe(historyStore);

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });

    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 3 }, 1])
    );

    const historyStored = storage.getItem("history");
    expect(historyStored).toBeDefined();

    const [historyState] = JSON.parse(historyStored!);
    expect(historyState.tracking).toBe(true);
    expect(historyState.past).toHaveLength(3);
    expect(historyState.future).toEqual([]);

    const newStore = persist(history(create({ count: 0 })), { storage });
    persist(newStore.history, { storage, key: "history" });

    expect(newStore.get()).toEqual({ count: 3 });
    expect(newStore.history.get().past).toHaveLength(3);
    expect(newStore.history.get().future).toEqual([]);

    newStore.history.undo();
    expect(newStore.get()).toEqual({ count: 2 });
    expect(newStore.history.get().past).toHaveLength(2);
    expect(newStore.history.get().future).toHaveLength(1);
  });

  test("history store doesn't commit own changes after transaction", () => {
    const store = history(create({ count: 0 }));

    store.set({ count: 1 });
    store.set({ count: 2 });
    expect(store.get()).toEqual({ count: 2 });
    expect(store.history.get().past).toHaveLength(2);

    transaction(() => {
      store.set({ count: 3 });
      store.set({ count: 4 });
      store.set({ count: 5 });
      store.set({ count: 6 });
      expect(store.history.get().past).toHaveLength(6);

      store.history.undo();
      expect(store.get()).toEqual({ count: 5 });
      expect(store.history.get().past).toHaveLength(5);
    });

    expect(store.get()).toEqual({ count: 5 });
    expect(store.history.get().past).toHaveLength(3);
  });
});

// Utils

function createMockStorage<T = string>() {
  const data = new Map<string, T>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: T) => {
      data.set(key, value);
    }
  };
}
