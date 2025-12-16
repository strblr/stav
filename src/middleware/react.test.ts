import { describe, expect, test } from "bun:test";
import { renderHook, render, screen } from "@testing-library/react";
import React, { act } from "react";
import { create } from "../create";
import { react } from "./react";
import { assign } from "./assign";
import { immer } from "./immer";
import { persist, type StorageLike } from "./persist";

describe("Basic functionality", () => {
  test("react returns enhanced store", () => {
    const store = react(create({}));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.getInitial).toBeFunction();
    expect(store.subscribe).toBeFunction();
    expect(store.use).toBeFunction();
  });

  test("react preserves handlers", () => {
    const store = react(
      create(
        { count: 0 },
        { inc: () => store.set(s => ({ ...s, count: s.count + 1 })) }
      )
    );

    expect(store.inc).toBeFunction();
    store.inc();
    expect(store.get()).toEqual({ count: 1 });
  });
});

describe("use() behavior", () => {
  test("use() returns full state and updates on set", () => {
    const store = react(create({ count: 0 }));

    const { result } = renderHook(() => store.use());
    expect(result.current).toEqual({ count: 0 });
    act(() => store.set(s => ({ ...s, count: s.count + 1 })));
    expect(result.current).toEqual({ count: 1 });
  });

  test("use(selector) returns selected slice and updates on set", () => {
    const store = react(create({ count: 0, other: 0 }));
    const { result } = renderHook(() => store.use(s => s.count));
    expect(result.current).toEqual(0);
    act(() => store.set(s => ({ ...s, count: s.count + 1 })));
    expect(result.current).toEqual(1);
  });

  test("use(selector) does not rerender when selected slice does not change", () => {
    const store = react(create({ count: 0, other: 0 }));
    let renders = 0;

    const { result } = renderHook(() => {
      renders++;
      return store.use(s => s.count);
    });

    const before = renders;
    act(() => store.set(s => ({ ...s, other: s.other + 1 })));
    expect(result.current).toBe(0);
    expect(renders).toBe(before);
  });

  test("custom equalFn can prevent rerenders even when slice reference changes", () => {
    const store = react(create({ obj: { a: 1 }, tick: 0 }));
    let renders = 0;
    const equalByA = (prev: { a: number }, next: { a: number }) =>
      prev.a === next.a;

    const { result } = renderHook(() => {
      renders++;
      return store.use(s => s.obj, equalByA);
    });

    const before = renders;
    act(() => store.set(s => ({ obj: { a: 1 }, tick: s.tick + 1 })));
    expect(result.current.a).toBe(1);
    expect(renders).toBe(before);
  });

  test("custom equalFn allows rerenders when slice changes", () => {
    const store = react(create({ obj: { a: 1 }, tick: 0 }));
    let renders = 0;
    const equalByA = (prev: { a: number }, next: { a: number }) =>
      prev.a === next.a;

    const { result } = renderHook(() => {
      renders++;
      return store.use(s => s.obj, equalByA);
    });

    const before = renders;
    act(() => store.set(s => ({ obj: { a: 2 }, tick: s.tick + 1 })));
    expect(result.current.a).toBe(2);
    expect(renders).toBeGreaterThan(before);
  });
});

describe("Middleware composition", () => {
  test("react works when composed with assign + immer", () => {
    const store = react(immer(assign(create({ items: [1], count: 1 }))));

    const { result } = renderHook(() => ({
      count: store.use(s => s.count),
      items: store.use(s => s.items)
    }));

    expect(result.current.count).toBe(1);
    expect(result.current.items).toEqual([1]);

    act(() =>
      store.set(state => {
        state.items.push(2);
        state.count = state.items.length;
      })
    );

    expect(result.current.count).toBe(2);
    expect(result.current.items).toEqual([1, 2]);
  });

  test("react survives being wrapped by persist (and vice versa)", () => {
    class MockStorage implements StorageLike<string> {
      private data = new Map<string, string>();

      getItem(key: string): string | null {
        return this.data.get(key) ?? null;
      }

      setItem(key: string, value: string): void {
        this.data.set(key, value);
      }

      removeItem(key: string): void {
        this.data.delete(key);
      }
    }

    const storage = new MockStorage();

    const storeA = persist(react(assign(create({ count: 0 }))), {
      storage,
      key: "react-a",
      autoHydrate: false
    });

    const storeB = react(
      persist(assign(create({ count: 0 })), {
        storage,
        key: "react-b",
        autoHydrate: false
      })
    );

    function TestComponents() {
      const countA = storeA.use(s => s.count);
      const countB = storeB.use(s => s.count);
      return React.createElement(
        React.Fragment,
        {},
        React.createElement("div", { "data-testid": "a" }, String(countA)),
        React.createElement("div", { "data-testid": "b" }, String(countB))
      );
    }

    render(React.createElement(TestComponents));

    act(() => {
      storeA.set({ count: 1 });
      storeB.set({ count: 2 });
    });

    expect(screen.getByTestId("a").textContent).toBe("1");
    expect(screen.getByTestId("b").textContent).toBe("2");

    // Sanity: persisted values exist (update path)
    expect(storage.getItem("react-a")).not.toBeNull();
    expect(storage.getItem("react-b")).not.toBeNull();
  });
});
