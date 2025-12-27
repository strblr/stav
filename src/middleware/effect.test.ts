import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { effect } from "./effect";
import { shallow } from "../utils";

describe("effect middleware", () => {
  test("adds effect to store", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("preserves original store methods", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);

    expect(store.get()).toEqual({ count: 0 });
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("works with custom handlers", () => {
    const effectFn = mock();
    const store = effect(
      create(
        { count: 0 },
        { increment: () => store.set({ count: store.get().count + 1 }) }
      ),
      effectFn
    );

    store.increment();
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });
});

describe("effect execution", () => {
  test("calls effect on state change", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);

    store.set({ count: 5 });
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
  });

  test("calls effect multiple times on multiple state changes", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);

    store.set({ count: 1 });
    store.set({ count: 2 });
    store.set({ count: 3 });

    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(effectFn).toHaveBeenNthCalledWith(1, { count: 1 }, { count: 0 });
    expect(effectFn).toHaveBeenNthCalledWith(2, { count: 2 }, { count: 1 });
    expect(effectFn).toHaveBeenNthCalledWith(3, { count: 3 }, { count: 2 });
  });

  test("calls effect with correct state when using updater function", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);

    store.set(state => ({ count: state.count + 1 }));
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });

  test("effect receives previous and current state correctly", () => {
    const states: Array<{ current: any; previous: any }> = [];
    const effectFn = (current: any, previous: any) => {
      states.push({ current, previous });
    };
    const store = effect(create({ count: 0, name: "test" }), effectFn);

    store.set({ count: 5, name: "test" });
    store.set({ count: 5, name: "updated" });

    expect(states).toEqual([
      {
        current: { count: 5, name: "test" },
        previous: { count: 0, name: "test" }
      },
      {
        current: { count: 5, name: "updated" },
        previous: { count: 5, name: "test" }
      }
    ]);
  });
});

describe("effect with different state types", () => {
  test("works with primitive state", () => {
    const effectFn = mock();
    const store = effect(create(0), effectFn);

    store.set(5);
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith(5, 0);
  });

  test("works with array state", () => {
    const effectFn = mock();
    const store = effect(create([1, 2, 3]), effectFn);

    store.set([4, 5, 6]);
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith([4, 5, 6], [1, 2, 3]);
  });

  test("works with null state", () => {
    const effectFn = mock();
    const store = effect(create<{ value: string } | null>(null), effectFn);

    store.set({ value: "test" });
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith({ value: "test" }, null);

    store.set(null);
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenCalledWith(null, { value: "test" });
  });

  test("works with undefined state", () => {
    const effectFn = mock();
    const store = effect(
      create<{ value: string } | undefined>(undefined),
      effectFn
    );

    store.set({ value: "test" });
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(effectFn).toHaveBeenCalledWith({ value: "test" }, undefined);

    store.set(undefined);
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(effectFn).toHaveBeenCalledWith(undefined, { value: "test" });
  });
});

describe("effect runs only when state was changed", () => {
  test("does call effect when setting new object", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);
    store.set({ count: 0 });
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  test("does not call effect when state is unchanged (same object reference)", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }), effectFn);
    store.set(store.get());
    expect(effectFn).not.toHaveBeenCalled();
  });

  test("does not call effect when state is unchanged (Object.is)", () => {
    const effectFn = mock();
    const store = effect(create(NaN), effectFn);
    store.set(NaN);
    expect(effectFn).not.toHaveBeenCalled();
  });

  test("does not call effect when state is unchanged (shallow equality)", () => {
    const effectFn = mock();
    const store = effect(create({ count: 0 }, {}, shallow), effectFn);
    store.set({ count: 0 });
    expect(effectFn).not.toHaveBeenCalled();
  });

  test("does call effect when state is changed (always changing)", () => {
    const effectFn = mock();
    const store = effect(
      create(0, {}, () => false),
      effectFn
    );
    store.set(0);
    expect(effectFn).toHaveBeenCalledTimes(1);
    store.set(0);
    expect(effectFn).toHaveBeenCalledTimes(2);
  });
});
