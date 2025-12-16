import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { assign } from "./assign";
import { immer } from "./immer";

describe("Basic functionality", () => {
  test("assign returns enhanced store", () => {
    const store = assign(create({}));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.getInitial).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("assign preserves original store functionality", () => {
    const store = assign(create({ message: "hello" }));

    expect(store.get()).toEqual({ message: "hello" });
    expect(store.getInitial()).toEqual({ message: "hello" });
  });

  test("assign works with handlers", () => {
    const store = assign(
      create(
        { count: 0 },
        { increment: () => store.set(state => ({ count: state.count + 1 })) }
      )
    );

    expect(store.increment).toBeFunction();
    store.increment();
    expect(store.get()).toEqual({ count: 1 });
  });
});

describe("Assign set functionality", () => {
  test("set with full object updates state", () => {
    const store = assign(create({ value: 0 }));
    store.set({ value: 42 });
    expect(store.get()).toEqual({ value: 42 });
  });

  test("set with partial object updates state", () => {
    const store = assign(create({ value: 0, other: "test" }));
    store.set({ value: 42 });
    expect(store.get()).toEqual({ value: 42, other: "test" });
  });

  test("set with function updater updates state", () => {
    const store = assign(create({ count: 0 }));
    store.set(state => ({ count: state.count + 10 }));
    expect(store.get()).toEqual({ count: 10 });
  });

  test("assign mutations don't affect original state reference", () => {
    const initialState = { items: [1, 2, 3] };
    const store = assign(create(initialState));

    store.set({ items: [...initialState.items, 4] });

    expect(store.get()).toEqual({ items: [1, 2, 3, 4] });
    expect(initialState).toEqual({ items: [1, 2, 3] });
  });

  test("assign set notifies listeners", () => {
    const listener = mock();
    const store = assign(create({ count: 0 }));
    store.subscribe(listener);

    store.set({ count: 5 });

    expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
  });
});

describe("Edge cases", () => {
  test("assign handles empty updates", () => {
    const store = assign(create({ count: 5 }));
    const listener = mock();
    store.subscribe(listener);
    store.set({});

    expect(store.get()).toEqual({ count: 5 });
    expect(listener).not.toHaveBeenCalled();
  });

  test("assign set preserves shallow equality optimization", () => {
    const listener = mock();
    const store = assign(create({ value: 42, other: "test" }));
    store.subscribe(listener);

    const sameObject = store.get();
    store.set(sameObject);
    expect(listener).not.toHaveBeenCalled();

    store.set({ value: 42, other: "test" });
    expect(listener).not.toHaveBeenCalled();

    store.set({ value: 43, other: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("assign works with immer middleware combination", () => {
    const listener = mock();
    const store = immer(assign(create({ items: [1, 2], count: 0 })));
    store.subscribe(listener);

    store.set(state => {
      state.items.push(3);
      state.count = state.items.length;
    });
    expect(store.get()).toEqual({ items: [1, 2, 3], count: 3 });
    expect(listener).toHaveBeenCalledTimes(1);

    store.set(store.get());
    expect(listener).toHaveBeenCalledTimes(1);

    store.set(state => {
      state.items = store.get().items;
      state.count = 3;
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ items: [1, 2, 3], count: 3 });
  });
});
