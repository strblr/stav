import { test, expect, mock, describe, beforeEach } from "bun:test";
import { create } from "../create";
import { persist, type StorageLike } from "./persist";

class MockStorage<R = string> implements StorageLike<R> {
  private data = new Map<string, R>();

  getItem(key: string): R | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: R): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

let storage: MockStorage;

beforeEach(() => {
  storage = new MockStorage();
});

describe("Basic functionality", () => {
  test("persist returns enhanced store with persist methods", () => {
    const store = persist(create(42));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
    expect(store.persist).toBeObject();
    expect(store.persist.hydrated).toBeBoolean();
    expect(store.persist.hydrate).toBeFunction();
    expect(store.persist.clear).toBeFunction();
  });

  test("persist preserves original store functionality", () => {
    const store = persist(create("hello"));

    expect(store.get()).toBe("hello");
    store.set("world");
    expect(store.get()).toBe("world");
    store.set(s => s + "!");
    expect(store.get()).toBe("world!");
    store.set(store.getInitial);
    expect(store.get()).toBe("hello");
  });

  test("persist works with handlers", () => {
    const store = persist(
      create(0, {
        increment: () => store.set(store.get() + 1)
      })
    );

    expect(store.increment).toBeFunction();
    expect(store.persist).toBeDefined();
  });

  test("hydrated starts as false and becomes true after successful hydration", () => {
    const storage = new MockStorage();
    storage.setItem("test-key", JSON.stringify(["stored data", 1]));

    const store = persist(create("test"), {
      key: "test-key",
      storage,
      autoHydrate: false
    });

    expect(store.persist.hydrated).toBe(false);
    store.persist.hydrate();
    expect(store.persist.hydrated).toBe(true);
  });

  test("hydrated stays false when no data to hydrate", () => {
    const storage = new MockStorage();
    const store = persist(create("test"), { storage, autoHydrate: false });

    expect(store.persist.hydrated).toBe(false);
    store.persist.hydrate();
    expect(store.persist.hydrated).toBe(false);
  });
});

describe("Storage interaction", () => {
  test("set persists state to storage", () => {
    const store = persist(create("initial"), { storage, key: "test-key" });

    store.set("updated");
    const stored = storage.getItem("test-key");
    expect(stored).not.toBeNull();

    const [partialized, version] = JSON.parse(stored!);
    expect(partialized).toBe("updated");
    expect(version).toBe(1);
  });

  test("hydrate loads state from storage", () => {
    const initialData = JSON.stringify(["stored data", 1]);
    storage.setItem("test-key", initialData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      autoHydrate: false
    });

    expect(store.get()).toBe("initial");
    store.persist.hydrate();
    expect(store.get()).toBe("stored data");
  });

  test("auto-hydrates by default", () => {
    const initialData = JSON.stringify(["auto-loaded", 1]);
    storage.setItem("test-key", initialData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key"
    });

    expect(store.get()).toBe("auto-loaded");
    expect(store.persist.hydrated).toBe(true);
  });

  test("clear removes data from storage", () => {
    storage.setItem("test-key", '["test",1]');
    const store = persist(create("test"), { storage, key: "test-key" });

    expect(storage.getItem("test-key")).toBe('["test",1]');
    store.persist.clear();
    expect(storage.getItem("test-key")).toBeNull();
  });

  test("set with function updater persists correctly", () => {
    const store = persist(create(10), { storage, key: "test-key" });

    store.set(x => x * 2);
    const stored = storage.getItem("test-key");
    const [partialized] = JSON.parse(stored!);
    expect(partialized).toBe(20);
  });

  test("no storage provided doesn't crash", () => {
    const store = persist(create("test"), { storage: undefined });

    expect(() => store.set("new value")).not.toThrow();
    expect(() => store.persist.hydrate()).not.toThrow();
    expect(() => store.persist.clear()).not.toThrow();
  });
});

describe("Serialization and deserialization", () => {
  test("default serialization works", () => {
    const store = persist(create({ count: 1, name: "test" }), {
      storage,
      key: "test-key"
    });

    store.set({ count: 2, name: "updated" });
    const stored = storage.getItem("test-key");
    expect(stored).toBe('[{"count":2,"name":"updated"},1]');
  });

  test("custom serialize/deserialize functions work", () => {
    const serialize = (data: any) => `CUSTOM:${JSON.stringify(data)}`;
    const deserialize = (data: string) => JSON.parse(data.slice(7));

    const store = persist(create("test"), {
      storage,
      key: "test-key",
      serialize,
      deserialize,
      autoHydrate: false
    });

    store.set("custom data");
    const stored = storage.getItem("test-key");
    expect(stored).toBe('CUSTOM:["custom data",1]');

    storage.setItem("test-key", 'CUSTOM:["custom data 2",1]');
    store.persist.hydrate();
    expect(store.get()).toBe("custom data 2");
  });
});

describe("Partialization", () => {
  test("default partialize (identity) works", () => {
    const fullState = { visible: true, internal: "secret" };
    const store = persist(create(fullState), {
      storage,
      key: "test-key"
    });

    store.set({ visible: false, internal: "updated" });
    const stored = storage.getItem("test-key");
    const [partialized] = JSON.parse(stored!);
    expect(partialized).toEqual({ visible: false, internal: "updated" });
  });

  test("custom partialize function works", () => {
    const partialize = (state: any) => ({ visible: state.visible });
    const fullState = { visible: true, internal: "secret" };
    const store = persist(create(fullState), {
      storage,
      key: "test-key",
      partialize
    });

    store.set({ visible: false, internal: "updated" });
    const stored = storage.getItem("test-key");
    const [partialized] = JSON.parse(stored!);
    expect(partialized).toEqual({ visible: false });
  });
});

describe("Versioning and migration", () => {
  test("version defaults to 1", () => {
    const store = persist(create("test"), {
      storage,
      key: "test-key"
    });

    store.set("updated");
    const stored = storage.getItem("test-key");
    const [, version] = JSON.parse(stored!);
    expect(version).toBe(1);
  });

  test("custom version is stored", () => {
    const store = persist(create("test"), {
      storage,
      key: "test-key",
      version: 5
    });

    store.set("updated");
    const stored = storage.getItem("test-key");
    const [, version] = JSON.parse(stored!);
    expect(version).toBe(5);
  });

  test("matching versions hydrate normally", () => {
    const storedData = JSON.stringify(["stored", 2]);
    storage.setItem("test-key", storedData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      version: 2
    });

    expect(store.get()).toBe("stored");
  });

  test("mismatched versions call migrate function", () => {
    const storedData = JSON.stringify(["old data", 1]);
    storage.setItem("test-key", storedData);

    const migrate = mock((data: any, version: number) => {
      expect(data).toBe("old data");
      expect(version).toBe(1);
      return "migrated data";
    });

    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      version: 2,
      migrate
    });

    expect(migrate).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe("migrated data");
  });

  test("no migrate function skips hydration on version mismatch", () => {
    const storedData = JSON.stringify(["old data", 1]);
    storage.setItem("test-key", storedData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      version: 2,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toBe("initial");
  });
});

describe("Merge functionality", () => {
  test("default merge (identity) replaces state", () => {
    const storedData = JSON.stringify([{ count: 5 }, 1]);
    storage.setItem("test-key", storedData);

    const store = persist(create<object>({ count: 1, name: "initial" }), {
      storage,
      key: "test-key",
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toEqual({ count: 5 });
  });

  test("custom merge function combines state", () => {
    const storedData = JSON.stringify([{ count: 5 }, 1]);
    storage.setItem("test-key", storedData);

    const merge = (partialized: any, currentState: any) => ({
      ...currentState,
      ...partialized,
      merged: true
    });

    const store = persist(create<object>({ count: 1, name: "initial" }), {
      storage,
      key: "test-key",
      merge,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toEqual({ count: 5, name: "initial", merged: true });
  });
});

describe("Auto-hydration", () => {
  test("autoHydrate defaults to true", () => {
    const storedData = JSON.stringify(["auto-hydrated", 1]);
    storage.setItem("test-key", storedData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key"
    });
    expect(store.get()).toBe("auto-hydrated");
    expect(store.persist.hydrated).toBe(true);
  });

  test("autoHydrate: false doesn't hydrate automatically", () => {
    const storedData = JSON.stringify(["should not load", 1]);
    storage.setItem("test-key", storedData);

    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      autoHydrate: false
    });
    expect(store.get()).toBe("initial");
    expect(store.persist.hydrated).toBe(false);
  });
});

describe("Callbacks", () => {
  test("onHydrate is called after successful hydration", () => {
    const storedData = JSON.stringify(["hydrated data", 1]);
    storage.setItem("test-key", storedData);

    const onHydrate = mock();
    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      onHydrate,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(onHydrate).toHaveBeenCalledWith("hydrated data", "initial");
  });

  test("onError is called on storage errors during set", () => {
    const errorStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage full");
      },
      removeItem: () => {}
    };

    const onError = mock();
    const store = persist(create("test"), {
      storage: errorStorage,
      onError
    });

    store.set("new value");
    expect(store.get()).toBe("new value");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "set");
  });

  test("onError is called on storage errors during hydrate", () => {
    const errorStorage = {
      getItem: () => {
        throw new Error("Storage corrupted");
      },
      setItem: () => {},
      removeItem: () => {}
    };

    const onError = mock();
    const store = persist(create("test"), {
      storage: errorStorage,
      onError
    });

    expect(store.get()).toBe("test");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "hydrate");
  });

  test("onError is called on storage errors during clear", () => {
    const errorStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error("Cannot delete");
      }
    };

    const onError = mock();
    const store = persist(create("test"), {
      storage: errorStorage,
      onError
    });

    store.persist.clear();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "clear");
  });

  test("onError is called on serialization errors", () => {
    const circular: any = {};
    circular.self = circular;

    const onError = mock();
    const store = persist(create({}), {
      storage,
      onError
    });

    store.set(circular);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "set");
  });
});

describe("Edge cases and error handling", () => {
  test("hydrate with no stored data does nothing", () => {
    const store = persist(create("initial"), {
      storage,
      autoHydrate: false
    });

    store.persist.hydrate();
    expect(store.get()).toBe("initial");
  });

  test("hydrate with invalid JSON calls onError", () => {
    storage.setItem("test-key", "invalid json");

    const onError = mock();
    const store = persist(create("initial"), {
      storage,
      key: "test-key",
      onError
    });

    expect(store.get()).toBe("initial");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "hydrate");
  });

  test("custom storage with different types", () => {
    const numStorage = new MockStorage<number>();
    const store = persist(create(42), {
      storage: numStorage,
      key: "test-key",
      serialize: ([data, version]) => data + version * 10,
      deserialize: data => [data - 10, Math.floor(data / 10) - 4]
    });

    store.set(100);
    expect(numStorage.getItem("test-key")).toBe(110);

    store.persist.hydrate();
    expect(store.get()).toBe(100);
  });

  test("key customization works", () => {
    const store1 = persist(create("store1"), { storage, key: "custom1" });
    const store2 = persist(create("store2"), { storage, key: "custom2" });

    store1.set("data1");
    store2.set("data2");

    expect(storage.getItem("custom1")).toBe('["data1",1]');
    expect(storage.getItem("custom2")).toBe('["data2",1]');
  });
});

describe("Integration with create functionality", () => {
  test("persist works with complex state and handlers", () => {
    const store = persist(
      create(
        {
          todos: [] as string[],
          filter: "all" as "all" | "completed"
        },
        {
          addTodo: (text: string) =>
            store.set(state => ({
              ...state,
              todos: [...state.todos, text]
            })),
          toggleFilter: () =>
            store.set(state => ({
              ...state,
              filter: state.filter === "all" ? "completed" : "all"
            }))
        }
      ),
      { storage, key: "test-key" }
    );

    store.addTodo("Test todo");
    store.toggleFilter();

    expect(store.get().todos).toEqual(["Test todo"]);
    expect(store.get().filter).toBe("completed");

    const stored = storage.getItem("test-key");
    const [partialized] = JSON.parse(stored!);
    expect(partialized.todos).toEqual(["Test todo"]);
    expect(partialized.filter).toBe("completed");
  });

  test("persist preserves subscription behavior", () => {
    const listener = mock();
    const store = persist(create(0), { storage });

    store.subscribe(listener);
    store.set(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });
});
