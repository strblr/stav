import { test, expect, mock, describe } from "bun:test";
import { create as vanilla } from "../create";
import { object, create } from "./object";

describe("object", () => {
  test("adds assign method to store", () => {
    const store = object(vanilla({ count: 0, name: "test" }));

    expect(store.assign).toBeFunction();
    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("assigns partial state with object", () => {
    const store = object(vanilla({ count: 0, name: "test", active: false }));

    store.assign({ count: 5 });
    expect(store.get()).toEqual({ count: 5, name: "test", active: false });
  });

  test("assigns multiple properties", () => {
    const store = object(vanilla({ count: 0, name: "test", active: false }));

    store.assign({ count: 10, name: "updated" });
    expect(store.get()).toEqual({ count: 10, name: "updated", active: false });
  });

  test("assigns with updater function", () => {
    const store = object(vanilla({ count: 0, name: "test" }));

    store.assign(state => ({ count: state.count + 5 }));
    expect(store.get()).toEqual({ count: 5, name: "test" });
  });

  test("assigns with multiple updater functions", () => {
    const store = object(vanilla({ count: 1, value: 10 }));

    store.assign(
      state => ({ count: state.count + 1 }),
      state => ({ count: state.count * 2 })
    );
    expect(store.get()).toEqual({ count: 4, value: 10 });
  });

  test("assigns with mixed objects and functions", () => {
    const store = object(vanilla({ count: 0, name: "test", active: false }));

    store.assign(
      { count: 5 },
      state => ({ name: state.name.toUpperCase() }),
      { active: true },
      state => ({ count: state.count * 2 })
    );
    expect(store.get()).toEqual({ count: 10, name: "TEST", active: true });
  });

  test("notifies subscribers on assign", () => {
    const store = object(vanilla({ count: 0, name: "test" }));
    const listener = mock();
    store.subscribe(listener);

    store.assign({ count: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { count: 5, name: "test" },
      { count: 0, name: "test" }
    );
  });

  test("original set method still works", () => {
    const store = object(vanilla({ count: 0, name: "test" }));

    store.set({ count: 5, name: "updated" });
    expect(store.get()).toEqual({ count: 5, name: "updated" });
  });

  test("works with custom handlers", () => {
    const store = object(
      vanilla(
        { count: 0, name: "test" },
        { increment: () => store.assign(state => ({ count: state.count + 1 })) }
      )
    );

    store.increment();
    expect(store.get()).toEqual({ count: 1, name: "test" });

    store.assign({ name: "updated" });
    expect(store.get()).toEqual({ count: 1, name: "updated" });
  });

  test("handles empty assign", () => {
    const store = object(vanilla({ count: 0, name: "test" }));
    const listener = mock();
    store.subscribe(listener);

    store.assign({});
    expect(store.get()).toEqual({ count: 0, name: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("create", () => {
  test("creates store with object middleware", () => {
    const store = create({ count: 0, name: "test" });

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
    expect(store.assign).toBeFunction();
  });

  test("creates store with initial state", () => {
    const store = create({ count: 0, name: "test", active: false });
    expect(store.get()).toEqual({ count: 0, name: "test", active: false });
  });

  test("assign works on created store", () => {
    const store = create({ count: 0, name: "test" });
    store.assign({ count: 5 });
    expect(store.get()).toEqual({ count: 5, name: "test" });
  });

  test("uses shallow equality by default", () => {
    const store = create({ count: 0, name: "test" });
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 0, name: "test" });
    expect(listener).not.toHaveBeenCalled();

    store.set({ count: 1, name: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("accepts custom handlers", () => {
    const store = create(
      { count: 0, name: "test" },
      {
        increment: () => store.assign({ count: store.get().count + 1 }),
        reset: () => store.set(store.getInitial)
      }
    );

    store.increment();
    expect(store.get()).toEqual({ count: 1, name: "test" });

    store.increment();
    expect(store.get()).toEqual({ count: 2, name: "test" });

    store.reset();
    expect(store.get()).toEqual({ count: 0, name: "test" });
  });

  test("accepts custom equality function", () => {
    const customEqual = mock((a: any, b: any) => a.count === b.count);
    const store = create({ count: 0, name: "test" }, {}, customEqual);
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 0, name: "updated" });

    expect(customEqual).toHaveBeenCalledWith(
      { count: 0, name: "test" },
      { count: 0, name: "updated" }
    );
    expect(listener).not.toHaveBeenCalled();
  });

  test("multiple independent stores", () => {
    const store1 = create({ count: 0 });
    const store2 = create({ value: "a" });

    store1.assign({ count: 5 });
    store2.assign({ value: "b" });

    expect(store1.get()).toEqual({ count: 5 });
    expect(store2.get()).toEqual({ value: "b" });
  });

  test("assign with complex nested state", () => {
    const store = create({
      user: { name: "Alice", age: 30 },
      settings: { theme: "light" }
    });

    store.assign({ user: { name: "Bob", age: 25 } });
    expect(store.get()).toEqual({
      user: { name: "Bob", age: 25 },
      settings: { theme: "light" }
    });
  });

  test("chaining multiple assigns", () => {
    const store = create({ a: 1, b: 2, c: 3 });

    store.assign({ a: 10 });
    store.assign({ b: 20 });
    store.assign({ c: 30 });

    expect(store.get()).toEqual({ a: 10, b: 20, c: 30 });
  });
});
