import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { persist } from "./async-persist";
import { immer } from "./immer";
import { transaction } from "../transaction";
import { slice } from "../utils";

describe("async-persist middleware", () => {
  test("adds persist store to main store", () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), { storage });

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
    expect(store.persist).toBeDefined();
    expect(store.persist.get).toBeFunction();
    expect(store.persist.hydrate).toBeFunction();
  });

  test("persist store has hydrating, hydrated, and persisting state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });
    expect(store.persist.get()).toEqual({
      hydrating: false,
      hydrated: false,
      persisting: false
    });
  });
});

describe("persist on state change", () => {
  test("persists state to storage on set", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 5 },
      1
    ]);
  });

  test("persists multiple state changes", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });
    await sleep(10);

    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 3 },
      1
    ]);
  });

  test("works without storage", () => {
    const store = persist(create({ count: 0 }), { storage: null });
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("does not persist during hydration", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    storage.setItem = mock(async (key, value) => {
      await sleep(1);
      storage.data.set(key, value);
    });

    await store.persist.hydrate();
    await sleep(10);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("does not persist during transaction", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    storage.setItem = mock(async (key, value) => {
      await sleep(1);
      storage.data.set(key, value);
    });

    await transaction(async act => {
      act(() => {
        store.set({ count: 1 });
        store.set({ count: 2 });
        store.set({ count: 3 });
      });
      await sleep(10);
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    await sleep(10);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 3 },
      1
    ]);
  });

  test("handles persist errors gracefully", async () => {
    const storage = createMockAsyncStorage();
    const errorHandler = mock();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: storage.getItem,
        setItem: async () => {
          await sleep(1);
          throw new Error("storage full");
        }
      },
      onError: errorHandler,
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(10);
    expect(store.get()).toEqual({ count: 5 });
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      new Error("storage full"),
      "persist"
    );
  });

  test("default onError handler logs and throws error", async () => {
    const storage = createMockAsyncStorage();
    const consoleError = mock();
    const originalConsoleError = console.error;
    console.error = consoleError;

    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: async () => {
          throw new Error("storage read failed");
        },
        setItem: storage.setItem
      },
      autoHydrate: false
    });

    await expect(store.persist.hydrate()).rejects.toThrow(
      "storage read failed"
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.anything(),
      new Error("storage read failed")
    );
    console.error = originalConsoleError;
  });

  test("sets persisting flag to false after persist completes", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(0);
    expect(store.persist.get().persisting).toBe(true);

    await sleep(10);
    expect(store.persist.get().persisting).toBe(false);
  });

  test("sets persisting flag to false after persist error", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: storage.getItem,
        setItem: async () => {
          await sleep(1);
          throw new Error("storage full");
        }
      },
      onError: () => {},
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(0);
    expect(store.persist.get().persisting).toBe(true);

    await sleep(10);
    expect(store.persist.get().persisting).toBe(false);
  });
});

describe("hydrate", () => {
  test("hydrates state from storage", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    expect(store.get()).toEqual({ count: 0 });
    expect(store.persist.get().hydrated).toBe(false);
    await store.persist.hydrate();
    expect(store.get()).toEqual({ count: 10 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("sets hydrating flag during hydration", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
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
    await store.persist.hydrate();
    expect(hydratingStates).toEqual([true, false]);
  });

  test("does nothing if no data in storage", async () => {
    const storage = createMockAsyncStorage();

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    await store.persist.hydrate();
    expect(store.get()).toEqual({ count: 0 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("auto-hydrates when autoHydrate is true (default)", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0 }), { storage });
    await sleep(10);
    expect(store.get()).toEqual({ count: 10 });
    expect(store.persist.get().hydrated).toBe(true);
  });

  test("handles hydrate errors gracefully", async () => {
    const storage = createMockAsyncStorage();
    const errorHandler = mock();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: async () => {
          await sleep(1);
          throw new Error("storage read failed");
        },
        setItem: storage.setItem
      },
      onError: errorHandler,
      autoHydrate: false
    });

    await expect(store.persist.hydrate()).rejects.toThrow(
      "storage read failed"
    );
    await sleep(10);
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      new Error("storage read failed"),
      "hydrate"
    );
    expect(store.persist.get().hydrating).toBe(false);
    expect(store.get()).toEqual({ count: 0 });
  });

  test("handles deserialization errors gracefully", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", "invalid json");
    const errorHandler = mock();

    const store = persist(create({ count: 0 }), {
      storage,
      deserialize: (str: string) => JSON.parse(str),
      onError: errorHandler,
      autoHydrate: false
    });

    await expect(store.persist.hydrate()).rejects.toThrow(SyntaxError);
    await sleep(10);
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), "hydrate");
    expect(store.persist.get().hydrating).toBe(false);
  });

  test("handles async migrate function", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ oldCount: 10 }, 1]);

    const store = persist(create({ count: 0 }), {
      storage,
      version: 2,
      migrate: async (state, version) => {
        await sleep(1);
        if (version === 1) {
          return { count: state.oldCount * 2 };
        }
        throw new Error("Unsupported version");
      }
    });

    await sleep(10);
    expect(store.get()).toEqual({ count: 20 });
  });
});

describe("options: key", () => {
  test("uses custom key for storage", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      key: "custom-key",
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(10);
    expect(await storage.getItem("custom-key")).toEqual([{ count: 5 }, 1]);
    expect(await storage.getItem("stav/async-persist")).toBe(null);
  });

  test("hydrates from custom key", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("custom-key", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0 }), {
      storage,
      key: "custom-key"
    });

    await sleep(10);
    expect(store.get()).toEqual({ count: 10 });
  });
});

describe("options: version/migrate", () => {
  test("stores version with state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      version: 5,
      autoHydrate: false
    });

    store.set({ count: 3 });
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 3 },
      5
    ]);
  });

  test("does not hydrate if version mismatch and no migrate", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0 }), {
      storage,
      version: 2,
      autoHydrate: false
    });

    await store.persist.hydrate();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("calls migrate on version mismatch", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ oldCount: 10 }, 1]);

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

    await sleep(10);
    expect(store.get()).toEqual({ count: 10 });
  });

  test("migrate receives correct version", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ value: 5 }, 3]);
    const migrate = mock((state: any) => state);

    persist(create({ value: 0 }), {
      storage,
      version: 4,
      migrate
    });

    await sleep(10);
    expect(migrate).toHaveBeenCalledWith({ value: 5 }, 3);
  });
});

describe("options: partialize", () => {
  test("persists only partialized state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(
      create({ count: 0, name: "test", internal: "secret" }),
      {
        storage,
        partialize: state => ({ count: state.count, name: state.name }),
        autoHydrate: false
      }
    );

    store.set({ count: 5, name: "updated", internal: "secret2" });
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 5, name: "updated" },
      1
    ]);
  });

  test("hydrates partialized state (default merge replaces)", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [
      { count: 10, name: "saved" },
      1
    ]);

    const store = persist(
      create({ count: 0, name: "test", internal: "secret" }),
      {
        storage,
        partialize: state => ({ count: state.count, name: state.name }),
        merge: (partialized, state) => ({ ...state, ...partialized })
      }
    );

    await sleep(10);
    expect(store.get()).toEqual({
      count: 10,
      name: "saved",
      internal: "secret"
    });
  });
});

describe("options: serialize/deserialize", () => {
  test("uses custom serializer", async () => {
    const storage = createMockAsyncStorage();
    const serialize = mock((value: any) => `custom:${JSON.stringify(value)}`);

    const store = persist(create({ count: 0 }), {
      storage,
      serialize,
      autoHydrate: false
    });

    store.set({ count: 5 });
    await sleep(10);
    expect(serialize).toHaveBeenCalledWith([{ count: 5 }, 1]);
    expect(await storage.getItem("stav/async-persist")).toBe(
      'custom:[{"count":5},1]'
    );
  });

  test("uses custom deserializer", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", 'custom:[{"count":10},1]');
    const deserialize = mock((str: string) =>
      JSON.parse(str.replace("custom:", ""))
    );

    const store = persist(create({ count: 0 }), {
      storage,
      deserialize
    });

    await sleep(10);
    expect(deserialize).toHaveBeenCalledWith('custom:[{"count":10},1]');
    expect(store.get()).toEqual({ count: 10 });
  });

  test("handles binary serialization", async () => {
    const storage = createMockAsyncStorage<Uint8Array>();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const createStore = (autoHydrate = true) =>
      persist(create({ count: 0 }), {
        storage,
        serialize: value => encoder.encode(JSON.stringify(value)),
        deserialize: bytes => JSON.parse(decoder.decode(bytes)),
        autoHydrate
      });

    const store = createStore(false);
    store.set({ count: 5 });
    await sleep(10);

    const store2 = createStore();
    await sleep(10);
    expect(store2.get()).toEqual({ count: 5 });
  });
});

describe("options: merge", () => {
  test("uses custom merge function", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0, name: "test", local: "value" }), {
      storage,
      merge: (partialized, state) => ({
        ...state,
        count: partialized.count,
        name: `${state.name}-hydrated`
      })
    });

    await sleep(10);
    expect(store.get()).toEqual({
      count: 10,
      name: "test-hydrated",
      local: "value"
    });
  });

  test("merge receives partialized and current state", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const merge = mock((partialized: any, state: any) => ({
      ...state,
      ...partialized
    }));

    persist(create({ count: 0, name: "test" }), {
      storage,
      merge
    });

    await sleep(10);
    expect(merge).toHaveBeenCalledWith(
      { count: 10 },
      { count: 0, name: "test" }
    );
  });
});

describe("options: debounce", () => {
  test("debounces multiple rapid state changes", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false,
      debounce: 10
    });

    storage.setItem = mock(async (key, value) => {
      await sleep(1);
      storage.data.set(key, value);
    });

    store.set({ count: 1 });
    await sleep(1);
    store.set({ count: 2 });
    await sleep(1);
    store.set({ count: 3 });
    await sleep(1);
    store.set({ count: 4 });
    await sleep(1);
    store.set({ count: 5 });
    await sleep(1);
    expect(storage.setItem).not.toHaveBeenCalled();

    await sleep(20);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 5 },
      1
    ]);
  });

  test("debounce with 0 delay persists in next tick", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false,
      debounce: 0
    });

    storage.setItem = mock(async (key, value) => {
      await sleep(1);
      storage.data.set(key, value);
    });

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });
    await sleep(0);
    expect(storage.setItem).toHaveBeenCalled();
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 3 },
      1
    ]);
  });
});

describe("integration", () => {
  test("persist and hydrate lifecycle", async () => {
    const storage = createMockAsyncStorage();
    const store1 = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store1.set({ count: 5 });
    store1.set({ count: 10 });
    await sleep(10);

    const store2 = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    await store2.persist.hydrate();
    expect(store2.get()).toEqual({ count: 10 });
  });

  test("multiple persist stores with different keys", async () => {
    const storage = createMockAsyncStorage();
    const store1 = persist(create({ count: 0 }), {
      storage,
      key: "store1",
      autoHydrate: false
    });

    const store2 = persist(create({ value: "" }), {
      storage,
      key: "store2",
      autoHydrate: false
    });

    store1.set({ count: 5 });
    store2.set({ value: "hello" });
    await sleep(10);
    expect(await storage.getItem("store1")).toEqual([{ count: 5 }, 1]);
    expect(await storage.getItem("store2")).toEqual([{ value: "hello" }, 1]);
  });

  test("works with custom handlers", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(
      create(
        { count: 0 },
        { increment: () => store.set({ count: store.get().count + 1 }) }
      ),
      { storage, autoHydrate: false }
    );

    store.increment();
    store.increment();
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 2 },
      1
    ]);
  });

  test("subscribers notified on hydrate", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const listener = mock();

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    store.subscribe(listener);
    await store.persist.hydrate();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 10 }, { count: 0 });
  });

  test("works with immer middleware", async () => {
    const storage = createMockAsyncStorage();

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
      { storage, autoHydrate: false }
    );

    store.produce(draft => {
      draft.user.name = "Bob";
      draft.user.age = 25;
      draft.todos[0].completed = true;
      draft.todos.push({ id: 3, text: "Task 3", completed: false });
    });
    await sleep(10);

    const store2 = persist(create({} as any), { storage });
    await sleep(10);

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
  test("handles null state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create<{ value: string } | null>(null), {
      storage,
      autoHydrate: false
    });

    store.set({ value: "test" });
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([
      { value: "test" },
      1
    ]);

    store.set(null);
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([null, 1]);
  });

  test("handles empty object state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({}), { storage, autoHydrate: false });
    store.set({});
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([{}, 1]);
  });

  test("handles array state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create([1, 2, 3]), { storage, autoHydrate: false });
    store.set([4, 5, 6]);
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([[4, 5, 6], 1]);
  });

  test("handles primitive state", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create(0), { storage, autoHydrate: false });
    store.set(42);
    await sleep(10);
    expect(await storage.getItem("stav/async-persist")).toEqual([42, 1]);
  });

  test("hydrate resets hydrating flag even on error", async () => {
    const storage = createMockAsyncStorage();
    const store = persist(create({ count: 0 }), {
      storage: {
        getItem: async () => {
          throw new Error("fail");
        },
        setItem: storage.setItem
      },
      onError: () => {},
      autoHydrate: false
    });

    await expect(store.persist.hydrate()).rejects.toThrow(Error);
    await sleep(10);
    expect(store.persist.get().hydrating).toBe(false);
  });

  test("multiple hydrate calls are idempotent when already hydrated", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem(
      "stav/async-persist",
      JSON.stringify([{ count: 10 }, 1])
    );
    const getItem = mock(
      async () => storage.data.get("stav/async-persist") ?? null
    );

    const store = persist(create({ count: 0 }), {
      storage: { getItem, setItem: storage.setItem },
      autoHydrate: false
    });

    await store.persist.hydrate();
    const count = store.get();
    await store.persist.hydrate();
    expect(store.get()).toEqual(count);
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  test("persists immediately after hydration completes", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    await store.persist.hydrate();
    store.set({ count: 20 });
    await sleep(10);

    expect(await storage.getItem("stav/async-persist")).toEqual([
      { count: 20 },
      1
    ]);
  });

  test("concurrent hydrate calls don't cause race conditions", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const getItem = mock(
      async () => storage.data.get("stav/async-persist") ?? null
    );
    const store = persist(create({ count: 0 }), {
      storage: { getItem, setItem: storage.setItem },
      autoHydrate: false
    });

    const promises = [
      store.persist.hydrate(),
      store.persist.hydrate(),
      store.persist.hydrate()
    ];

    await Promise.all(promises);
    expect(store.get()).toEqual({ count: 10 });
    expect(store.persist.get().hydrating).toBe(false);
    expect(store.persist.get().hydrated).toBe(true);
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});

// Utils

function createMockAsyncStorage<T = any>() {
  const data = new Map<string, T>();
  return {
    data,
    getItem: async (key: string) => {
      await sleep(1);
      return data.get(key) ?? null;
    },
    setItem: async (key: string, value: T) => {
      await sleep(1);
      data.set(key, value);
    }
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
