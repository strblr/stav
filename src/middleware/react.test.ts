import { test, expect, mock, describe } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { create } from "../create";
import { react, useStore, useHydration } from "./react";
import { persist } from "./persist";
import { persist as asyncPersist } from "./async-persist";
import { shallow } from "../utils";

describe("react middleware", () => {
  test("adds use method to store", () => {
    const store = create({ count: 0 });
    const reactStore = react(store);

    expect(reactStore.use).toBeFunction();
    expect(reactStore.get).toBeFunction();
    expect(reactStore.set).toBeFunction();
    expect(reactStore.subscribe).toBeFunction();
  });

  test("use hook returns current state", () => {
    const store = react(create({ count: 0 }));

    const { result } = renderHook(() => store.use());
    expect(result.current).toEqual({ count: 0 });
  });

  test("use hook updates when state changes", async () => {
    const store = react(create({ count: 0 }));

    const { result } = renderHook(() => store.use());
    expect(result.current).toEqual({ count: 0 });

    act(() => store.set({ count: 1 }));
    await waitFor(() => {
      expect(result.current).toEqual({ count: 1 });
    });
  });

  test("use hook with selector", async () => {
    const store = react(create({ count: 0, name: "test" }));

    const { result } = renderHook(() => store.use(state => state.count));
    expect(result.current).toBe(0);

    act(() => store.set({ count: 5, name: "test" }));
    await waitFor(() => {
      expect(result.current).toBe(5);
    });
  });

  test("use hook with selector only re-renders when selected value changes", async () => {
    const store = react(create({ count: 0, name: "test" }));
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return store.use(state => state.count);
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(0);

    act(() => {
      store.set({ count: 0, name: "changed" });
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.set({ count: 1, name: "changed" });
    });

    await waitFor(() => {
      expect(result.current).toBe(1);
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  test("use hook with custom equality function", async () => {
    const store = react(create({ items: [1, 2, 3] }));
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return store.use(
        state => state.items,
        (a, b) => a.length === b.length
      );
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([1, 2, 3]);

    act(() => {
      store.set({ items: [4, 5, 6] });
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([1, 2, 3]);

    act(() => {
      store.set({ items: [1, 2, 3, 4] });
    });

    await waitFor(() => {
      expect(result.current).toEqual([1, 2, 3, 4]);
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  test("use hook with shallow equality", async () => {
    const store = react(create({ user: { name: "Alice", age: 30 } }));
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return store.use(state => state.user, shallow);
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ name: "Alice", age: 30 });

    act(() => {
      store.set({ user: { name: "Alice", age: 30 } });
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.set({ user: { name: "Bob", age: 30 } });
    });

    await waitFor(() => {
      expect(result.current).toEqual({ name: "Bob", age: 30 });
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  test("multiple hooks subscribe to same store", async () => {
    const store = react(create({ count: 0 }));

    const { result: result1 } = renderHook(() => store.use());
    const { result: result2 } = renderHook(() => store.use());

    expect(result1.current).toEqual({ count: 0 });
    expect(result2.current).toEqual({ count: 0 });

    act(() => {
      store.set({ count: 5 });
    });

    await waitFor(() => {
      expect(result1.current).toEqual({ count: 5 });
      expect(result2.current).toEqual({ count: 5 });
    });
  });

  test("multiple hooks with different selectors", async () => {
    const store = react(create({ count: 0, name: "test" }));

    const { result: countResult } = renderHook(() =>
      store.use(state => state.count)
    );
    const { result: nameResult } = renderHook(() =>
      store.use(state => state.name)
    );

    expect(countResult.current).toBe(0);
    expect(nameResult.current).toBe("test");

    act(() => {
      store.set({ count: 10, name: "updated" });
    });

    await waitFor(() => {
      expect(countResult.current).toBe(10);
      expect(nameResult.current).toBe("updated");
    });
  });
});

describe("useStore hook", () => {
  test("useStore without selector returns full state", () => {
    const store = create({ count: 0, name: "test" });

    const { result } = renderHook(() => useStore(store));
    expect(result.current).toEqual({ count: 0, name: "test" });
  });

  test("useStore with selector", async () => {
    const store = create({ count: 0, name: "test" });

    const { result } = renderHook(() => useStore(store, state => state.count));
    expect(result.current).toBe(0);

    act(() => {
      store.set({ count: 10, name: "test" });
    });

    await waitFor(() => {
      expect(result.current).toBe(10);
    });
  });

  test("useStore with complex selector", async () => {
    const store = create({
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" }
      ]
    });

    const { result } = renderHook(() =>
      useStore(
        store,
        state => state.users.map(u => u.name),
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      )
    );

    expect(result.current).toEqual(["Alice", "Bob"]);

    act(() => {
      store.set({
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Charlie" }
        ]
      });
    });

    await waitFor(() => {
      expect(result.current).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  test("useStore with equality function prevents unnecessary renders", async () => {
    const store = create({ items: [1, 2, 3] });
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return useStore(
        store,
        state => state.items,
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      );
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([1, 2, 3]);

    act(() => {
      store.set({ items: [1, 2, 3] });
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.set({ items: [1, 2, 3, 4] });
    });

    await waitFor(() => {
      expect(result.current).toEqual([1, 2, 3, 4]);
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  test("useStore batches multiple updates (React feature)", async () => {
    const store = create({ count: 0 });
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return useStore(store);
    });

    expect(result.current).toEqual({ count: 0 });

    act(() => {
      store.set({ count: 1 });
      store.set({ count: 2 });
      store.set({ count: 3 });
      store.set({ count: 4 });
      store.set({ count: 5 });
    });

    await waitFor(() => {
      expect(result.current).toEqual({ count: 5 });
    });
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  test("useStore selector receives current state", async () => {
    const store = create({ count: 0 });
    const selectorSpy = mock((state: { count: number }) => state.count);

    const { result } = renderHook(() => useStore(store, selectorSpy));

    expect(selectorSpy).toHaveBeenCalledWith({ count: 0 });
    expect(result.current).toBe(0);

    act(() => {
      store.set({ count: 5 });
    });

    await waitFor(() => {
      expect(result.current).toBe(5);
    });

    expect(selectorSpy).toHaveBeenCalledWith({ count: 5 });
  });

  test("useStore with primitive state", async () => {
    const store = create(42);

    const { result } = renderHook(() => useStore(store));
    expect(result.current).toBe(42);

    act(() => {
      store.set(100);
    });

    await waitFor(() => {
      expect(result.current).toBe(100);
    });
  });

  test("useStore with array state", async () => {
    const store = create([1, 2, 3]);

    const { result } = renderHook(() => useStore(store));
    expect(result.current).toEqual([1, 2, 3]);

    act(() => {
      store.set([4, 5, 6]);
    });

    await waitFor(() => {
      expect(result.current).toEqual([4, 5, 6]);
    });
  });

  test("useStore with null state", async () => {
    const store = create<{ value: string } | null>({ value: "test" });

    const { result } = renderHook(() => useStore(store));
    expect(result.current).toEqual({ value: "test" });

    act(() => {
      store.set(null);
    });

    await waitFor(() => {
      expect(result.current).toBe(null);
    });
  });
});

describe("edge cases", () => {
  test("multiple stores with react middleware", async () => {
    const store1 = react(create({ count: 0 }));
    const store2 = react(create({ value: "a" }));

    const { result: result1 } = renderHook(() => store1.use());
    const { result: result2 } = renderHook(() => store2.use());

    expect(result1.current).toEqual({ count: 0 });
    expect(result2.current).toEqual({ value: "a" });

    act(() => {
      store1.set({ count: 5 });
      store2.set({ value: "b" });
    });

    await waitFor(() => {
      expect(result1.current).toEqual({ count: 5 });
      expect(result2.current).toEqual({ value: "b" });
    });
  });

  test("selector returns same reference with equality function", async () => {
    const store = react(create({ nested: { value: 1 } }));
    const renderSpy = mock();

    const { result } = renderHook(() => {
      renderSpy();
      return store.use(
        state => state.nested,
        (a, b) => a.value === b.value
      );
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const firstRef = result.current;

    act(() => {
      store.set({ nested: { value: 1 } });
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(firstRef);
  });

  test("equality function called with previous and next values", async () => {
    const store = react(create({ count: 0 }));
    const equalFn = mock((a: number, b: number) => a === b);

    const { result } = renderHook(() =>
      store.use(state => state.count, equalFn)
    );

    expect(result.current).toBe(0);

    equalFn.mockClear();

    act(() => {
      store.set({ count: 1 });
    });

    await waitFor(() => {
      expect(result.current).toBe(1);
    });

    expect(equalFn).toHaveBeenCalledWith(0, 1);
  });

  test("hook works with store that has custom handlers", async () => {
    const store = react(
      create(
        { count: 0 },
        {
          increment: (store: any) =>
            store.set((s: any) => ({ count: s.count + 1 })),
          decrement: (store: any) =>
            store.set((s: any) => ({ count: s.count - 1 }))
        }
      )
    );

    const { result } = renderHook(() => store.use());
    expect(result.current).toEqual({ count: 0 });

    act(() => store.increment(store));

    await waitFor(() => {
      expect(result.current).toEqual({ count: 1 });
    });

    act(() => store.decrement(store));

    await waitFor(() => {
      expect(result.current).toEqual({ count: 0 });
    });
  });

  test("selector identity doesn't cause issues", async () => {
    const store = react(create({ count: 0 }));
    const renderSpy = mock();

    const { result, rerender } = renderHook(
      ({ sel }) => {
        renderSpy();
        return store.use(sel);
      },
      { initialProps: { sel: (s: { count: number }) => s.count } }
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(0);

    rerender({ sel: (s: { count: number }) => s.count });

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(0);

    act(() => store.set({ count: 5 }));

    await waitFor(() => {
      expect(result.current).toBe(5);
    });
    expect(renderSpy).toHaveBeenCalledTimes(3);
  });
});

describe("useHydration hook", () => {
  test("returns true when store is already hydrated", () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), { storage });
    const { result } = renderHook(() => useHydration([store]));
    expect(result.current).toBe(true);
  });

  test("returns false initially when autoHydrate is disabled", async () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    const { result } = renderHook(() => useHydration([store]));
    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(store.persist.get().hydrated).toBe(true);
    });
  });

  test("returns true after hydration completes", async () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    const { result } = renderHook(() => useHydration([store]));
    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  test("works with multiple stores - all hydrated", () => {
    const storage1 = createMockStorage();
    const storage2 = createMockStorage();
    const store1 = persist(create({ count: 0 }), {
      storage: storage1,
      key: "store1"
    });
    const store2 = persist(create({ value: "a" }), {
      storage: storage2,
      key: "store2"
    });

    const { result } = renderHook(() => useHydration([store1, store2]));
    expect(result.current).toBe(true);
  });

  test("works with multiple stores - one not hydrated", async () => {
    const storage1 = createMockStorage();
    const storage2 = createMockStorage();
    const store1 = persist(create({ count: 0 }), {
      storage: storage1,
      key: "store1"
    });
    const store2 = persist(create({ value: "a" }), {
      storage: storage2,
      key: "store2",
      autoHydrate: false
    });

    const { result } = renderHook(() => useHydration([store1, store2]));
    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(store2.persist.get().hydrated).toBe(true);
    });
  });

  test("works with multiple stores - all not hydrated", async () => {
    const storage1 = createMockStorage();
    const storage2 = createMockStorage();
    storage1.setItem("store1", JSON.stringify([{ count: 5 }, 1]));
    storage2.setItem("store2", JSON.stringify([{ value: "b" }, 1]));

    const store1 = persist(create({ count: 0 }), {
      storage: storage1,
      key: "store1",
      autoHydrate: false
    });
    const store2 = persist(create({ value: "a" }), {
      storage: storage2,
      key: "store2",
      autoHydrate: false
    });

    const { result } = renderHook(() => useHydration([store1, store2]));
    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(store1.persist.get().hydrated).toBe(true);
      expect(store2.persist.get().hydrated).toBe(true);
    });
  });

  test("works with async persist stores", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);

    const store = asyncPersist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });
    expect(store.persist.get().hydrating).toBe(false);

    const { result } = renderHook(() => useHydration([store]));
    expect(result.current).toBe(false);
    expect(store.persist.get().hydrating).toBe(true);

    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(store.persist.get().hydrated).toBe(true);
    });
  });

  test("works with hydrating async persist store", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const store = asyncPersist(create({ count: 0 }), {
      storage
    });
    expect(store.persist.get().hydrating).toBe(true);

    const { result } = renderHook(() => useHydration([store]));

    expect(store.persist.get().hydrated).toBe(false);
    expect(store.persist.get().hydrating).toBe(true);
    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(store.persist.get().hydrated).toBe(true);
      expect(store.persist.get().hydrating).toBe(false);
    });
  });

  test("works with hydrated async persist store", async () => {
    const storage = createMockAsyncStorage();
    await storage.setItem("stav/async-persist", [{ count: 10 }, 1]);
    const store = asyncPersist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });
    await store.persist.hydrate();

    const { result } = renderHook(() => useHydration([store]));
    expect(result.current).toBe(true);
  });

  test("works with mixed sync and async persist stores", async () => {
    const syncStorage = createMockStorage();
    syncStorage.setItem("sync-store", JSON.stringify([{ count: 5 }, 1]));
    const asyncStorage = createMockAsyncStorage();
    await asyncStorage.setItem("async-store", [{ value: "test" }, 1]);

    const syncStore = persist(create({ count: 0 }), {
      storage: syncStorage,
      key: "sync-store",
      autoHydrate: false
    });
    const asyncStore = asyncPersist(create({ value: "a" }), {
      storage: asyncStorage,
      key: "async-store",
      autoHydrate: false
    });

    const { result } = renderHook(() => useHydration([syncStore, asyncStore]));
    expect(result.current).toBe(false);
    await waitFor(() => {
      expect(result.current).toBe(true);
      expect(syncStore.persist.get().hydrated).toBe(true);
      expect(asyncStore.persist.get().hydrated).toBe(true);
    });
  });

  test("handles empty stores array", () => {
    const { result } = renderHook(() => useHydration([]));
    expect(result.current).toBe(true);
  });

  test("only triggers hydration once per store", async () => {
    const storage = createMockStorage();
    storage.setItem("stav/persist", JSON.stringify([{ count: 10 }, 1]));
    const store = persist(create({ count: 0 }), {
      storage,
      autoHydrate: false
    });

    const hydrateSpy = mock(store.persist.hydrate);
    store.persist.hydrate = hydrateSpy;

    const { rerender } = renderHook(() => useHydration([store]));

    await waitFor(() => {
      expect(hydrateSpy).toHaveBeenCalledTimes(1);
    });

    rerender();
    await sleep(5);
    expect(hydrateSpy).toHaveBeenCalledTimes(1);
  });

  test("does not trigger hydration for already hydrated stores", async () => {
    const storage = createMockStorage();
    const store = persist(create({ count: 0 }), { storage });

    const hydrateSpy = mock(store.persist.hydrate);
    store.persist.hydrate = hydrateSpy;

    renderHook(() => useHydration([store]));
    await sleep(5);
    expect(hydrateSpy).not.toHaveBeenCalled();
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
