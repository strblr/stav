import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { persist } from "./persist";
import { immer } from "./immer";
import { transaction } from "../transaction";
import { shallow, slice } from "../utils";

describe("persist middleware", () => {
  test("adds persist store to main store", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), { storage });

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
    expect(store.persist).toBeDefined();
    expect(store.persist.get).toBeFunction();
    expect(store.persist.hydrate).toBeFunction();
  });

  test("persist store has hydrating and hydrated state", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    expect(store.persist.get()).toEqual({
      hydrating: false,
      hydrated: false
    });
  });
});

describe("persist on state change", () => {
  test("persists state to storage on set", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.set({ count: 5 });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 5 }, 1])
    );
  });

  test("persists multiple state changes", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });

    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 3 }, 1])
    );
  });

  test("works without storage", () => {
    const store = persist(create({ count: 0 }), { storage: null });
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("does not persist during hydration", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    storage.setItem = mock((key, value) => {
      storage.data.set(key, value);
    });

    store.persist.hydrate();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("does not persist during transaction", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), { storage });

    storage.setItem = mock((key, value) => {
      storage.data.set(key, value);
    });

    transaction(() => {
      store.set({ count: 1 });
      store.set({ count: 2 });
      store.set({ count: 3 });
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 3 }, 1])
    );
  });

  test("handles persist errors gracefully", () => {
    const storage = createMockStorage();
    const errorHandler = mock();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: storage.getItem,
        setItem: () => {
          throw new Error("storage full");
        }
      },
      onError: errorHandler
    });

    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      new Error("storage full"),
      "persist"
    );
  });
});

describe("hydrate", () => {
  test("hydrates state from storage", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    expect(store.get()).toEqual({ count: 0 });
    store.persist.hydrate();
    expect(store.get()).toEqual({ count: 10 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("sets hydrating flag during hydration", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });
    const hydratingStates: boolean[] = [];

    store.persist.subscribe(
      slice(
        state => state.hydrating,
        hydrating => {
          hydratingStates.push(hydrating);
        }
      )
    );

    expect(hydratingStates).toEqual([]);
    store.persist.hydrate();
    expect(hydratingStates).toEqual([true, false]);
  });

  test("does nothing if no data in storage", () => {
    const storage = createMockStorage();

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toEqual({ count: 0 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("auto-hydrates when autoHydrate is true (default)", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), { storage });
    expect(store.get()).toEqual({ count: 10 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("handles hydrate errors gracefully", () => {
    const storage = createMockStorage();
    const errorHandler = mock();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: () => {
          throw new Error("storage read failed");
        },
        setItem: storage.setItem
      },
      onError: errorHandler
    });

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      new Error("storage read failed"),
      "hydrate"
    );
    expect(store.persist.get().hydrating).toBe(false);
    expect(store.get()).toEqual({ count: 0 });
  });

  test("handles deserialization errors gracefully", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", "invalid json");
    const errorHandler = mock();

    const store = persist(create({ count: 0 }), {
      storage,
      onError: errorHandler
    });

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), "hydrate");
    expect(store.persist.get().hydrating).toBe(false);
  });
});

describe("options: key", () => {
  test("uses custom key for storage", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      key: "custom-key"
    });

    store.set({ count: 5 });
    expect(storage.getItem("custom-key")).toBe(
      JSON.stringify([{ count: 5 }, 1])
    );
    expect(storage.getItem("stav/persist")).toBe(null);
  });

  test("hydrates from custom key", () => {
    const storage = createMockStorage();
    storage.setItem("custom-key", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      key: "custom-key"
    });
    expect(store.get()).toEqual({ count: 10 });
  });
});

describe("options: version/migrate", () => {
  test("stores version with state", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      version: 5
    });

    store.set({ count: 3 });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 3 }, 5])
    );
  });

  test("does not hydrate if version mismatch and no migrate", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      version: 2,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("hydrated is true even if version mismatch and no migrate", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      version: 2,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.persist.get().hydrated).toBe(true);
    expect(store.get()).toEqual({ count: 0 });
  });

  test("calls migrate on version mismatch", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ oldCount: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      version: 2,
      migrate: (state, version) => {
        if (version === 1) {
          return { count: state.oldCount };
        }
        throw new Error("Unsupported version");
      }
    });

    expect(store.get()).toEqual({ count: 10 });
  });

  test("migrate receives correct version", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ value: 5 }, 3]));
    const migrate = mock((state: any) => state);

    persist(create({ value: 0 }), {
      storage,
      version: 4,
      migrate
    });
    expect(migrate).toHaveBeenCalledWith({ value: 5 }, 3);
  });
});

describe("options: partialize", () => {
  test("persists only partialized state", () => {
    const storage = createMockStorage();
    const store = persist(
      create({ count: 0, name: "test", internal: "secret" }),
      {
        storage,
        partialize: state => ({ count: state.count, name: state.name })
      }
    );

    store.set({ count: 5, name: "updated", internal: "secret2" });

    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 5, name: "updated" }, 1])
    );
  });

  test("hydrates partialized state (default merge replaces)", () => {
    const storage = createMockStorage();
    storage.setItem(
      "stav/persist",
      JSON.stringify([{ count: 10, name: "saved" }, 1])
    );

    const store = persist(
      create({ count: 0, name: "test", internal: "secret" }),
      {
        storage,
        partialize: state => ({ count: state.count, name: state.name }),
        merge: (partialized, state) => ({ ...state, ...partialized })
      }
    );

    expect(store.get()).toEqual({
      count: 10,
      name: "saved",
      internal: "secret"
    });
  });
});

describe("options: serialize/deserialize", () => {
  test("uses custom serializer", () => {
    const storage = createMockStorage();
    const serialize = mock((value: any) => `custom:${JSON.stringify(value)}`);

    const store = persist(create({ count: 0 }), { storage, serialize });

    store.set({ count: 5 });
    expect(serialize).toHaveBeenCalledWith([{ count: 5 }, 1]);
    expect(storage.getItem("stav/persist")).toBe('custom:[{"count":5},1]');
  });

  test("uses custom deserializer", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", 'custom:[{"count":10},1]');
    const deserialize = mock((str: string) =>
      JSON.parse(str.replace("custom:", ""))
    );

    const store = persist(create({ count: 0 }), {
      storage,
      serialize: (value: any) => `custom:${JSON.stringify(value)}`,
      deserialize
    });

    expect(deserialize).toHaveBeenCalledWith('custom:[{"count":10},1]');
    expect(store.get()).toEqual({ count: 10 });
  });

  test("handles binary serialization", () => {
    const storage = createMockStorage<Uint8Array>();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const createStore = () =>
      persist(create({ count: 0 }), {
        storage,
        serialize: value => encoder.encode(JSON.stringify(value)),
        deserialize: bytes => JSON.parse(decoder.decode(bytes))
      });

    const store = createStore();
    store.set({ count: 5 });

    const store2 = createStore();
    expect(store2.get()).toEqual({ count: 5 });
  });
});

describe("options: merge", () => {
  test("uses custom merge function", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0, name: "test", local: "value" }), {
      storage,
      merge: (partialized, state) => ({
        ...state,
        count: partialized.count,
        name: `${state.name}-hydrated`
      })
    });

    expect(store.get()).toEqual({
      count: 10,
      name: "test-hydrated",
      local: "value"
    });
  });

  test("merge receives partialized and current state", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const merge = mock((partialized: any, state: any) => ({
      ...state,
      ...partialized
    }));

    persist(create({ count: 0, name: "test" }), {
      storage,
      merge
    });

    expect(merge).toHaveBeenCalledWith(
      { count: 10 },
      { count: 0, name: "test" }
    );
  });
});

describe("integration", () => {
  test("persist and hydrate lifecycle", () => {
    const storage = createMockStorage();

    const store1 = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store1.set({ count: 5 });
    store1.set({ count: 10 });

    const store2 = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store2.persist.hydrate();
    expect(store2.get()).toEqual({ count: 10 });
  });

  test("multiple persist stores with different keys", () => {
    const storage = createMockStorage();

    const store1 = persist(create({ count: 0 }), {
      storage,
      key: "store1"
    });

    const store2 = persist(create({ value: "" }), {
      storage,
      key: "store2"
    });

    store1.set({ count: 5 });
    store2.set({ value: "hello" });

    expect(storage.getItem("store1")).toBe(JSON.stringify([{ count: 5 }, 1]));
    expect(storage.getItem("store2")).toBe(
      JSON.stringify([{ value: "hello" }, 1])
    );
  });

  test("works with custom handlers", () => {
    const storage = createMockStorage();

    const store = persist(
      create(
        { count: 0 },
        { increment: () => store.set({ count: store.get().count + 1 }) }
      ),
      { storage }
    );

    store.increment();
    store.increment();
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 2 }, 1])
    );
  });

  test("subscribers notified on hydrate", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const listener = mock();

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.subscribe(listener);
    store.persist.hydrate();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 10 }, { count: 0 });
  });

  test("works with immer middleware", () => {
    const storage = createMockStorage();

    const store = persist(
      immer(
        create({
          user: { name: "Alice", age: 30 },
          settings: { theme: "light", notifications: true },
          todos: [
            { id: 1, text: "Task 1", completed: false },
            { id: 2, text: "Task 2", completed: true }
          ]
        })
      ),
      { storage }
    );

    store.produce(draft => {
      draft.user.name = "Bob";
      draft.user.age = 25;
      draft.todos[0].completed = true;
      draft.todos.push({ id: 3, text: "Task 3", completed: false });
    });

    const store2 = persist(create({} as any), { storage });

    expect(store2.get()).toEqual({
      user: { name: "Bob", age: 25 },
      settings: { theme: "light", notifications: true },
      todos: [
        { id: 1, text: "Task 1", completed: true },
        { id: 2, text: "Task 2", completed: true },
        { id: 3, text: "Task 3", completed: false }
      ]
    });
  });
});

describe("edge cases", () => {
  test("handles null state", () => {
    const storage = createMockStorage();
    const store = persist(create<{ value: string } | null>(null), { storage });

    store.set({ value: "test" });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ value: "test" }, 1])
    );
  });

  test("handles empty object state", () => {
    const storage = createMockStorage();
    const store = persist(create({}), { storage });

    store.set({});
    expect(storage.getItem("stav/persist")).toBe(JSON.stringify([{}, 1]));
  });

  test("handles array state", () => {
    const storage = createMockStorage();
    const store = persist(create([1, 2, 3]), { storage });

    store.set([4, 5, 6]);
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([[4, 5, 6], 1])
    );
  });

  test("handles primitive state", () => {
    const storage = createMockStorage();
    const store = persist(create(0), { storage });

    store.set(42);
    expect(storage.getItem("stav/persist")).toBe(JSON.stringify([42, 1]));
  });

  test("hydrate resets hydrating flag even on error", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: () => {
          throw new Error("fail");
        },
        setItem: storage.setItem
      },
      onError: () => {},
      autoHydrate: false
    });

    try {
      store.persist.hydrate();
    } catch {}
    expect(store.persist.get().hydrating).toBe(false);
  });

  test("multiple hydrate calls are idempotent when already hydrated", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const getItem = mock(() => storage.data.get("stav/persist") ?? null);

    const store = persist(create({ count: 0 }), {
      storage: { getItem, setItem: storage.setItem },
      autoHydrate: false
    });

    store.persist.hydrate();
    const count = store.get();

    store.persist.hydrate();

    expect(store.get()).toEqual(count);
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  test("persists immediately after hydration completes", () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.persist.hydrate();
    store.set({ count: 20 });
    expect(storage.getItem("stav/persist")).toBe(
      JSON.stringify([{ count: 20 }, 1])
    );
  });

  test("idempotent set calls don't trigger persist", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }, {}, shallow), {
      storage,
      autoHydrate: false
    });

    storage.setItem = mock(async (key, value) => {
      storage.data.set(key, value);
    });

    store.set({ count: 0 });
    expect(storage.setItem).toHaveBeenCalledTimes(0);
    expect(storage.getItem("stav/persist")).toEqual(null);
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
