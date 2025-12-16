import { test, expect, mock, describe } from "bun:test";
import { shallow, slice } from "./utils";
import { create } from "./create";

describe("shallow", () => {
  test("returns true for same object reference", () => {
    const obj = { a: 1 };
    expect(shallow(obj, obj)).toBe(true);
  });

  test("returns true for shallow equal objects", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    expect(shallow(obj1, obj2)).toBe(true);
    expect(shallow(obj2, obj1)).toBe(true);
  });

  test("returns false for objects with different values", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    expect(shallow(obj1, obj2)).toBe(false);
    expect(shallow(obj2, obj1)).toBe(false);
  });

  test("returns false for objects with different keys", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 1, b: 2 };
    expect(shallow(obj1, obj2)).toBe(false);
    expect(shallow(obj2, obj1)).toBe(false);
  });

  test("returns false for null and object", () => {
    const obj = { a: 1 };
    expect(shallow(obj, null as any)).toBe(false);
    expect(shallow(null as any, obj)).toBe(false);
  });

  test("returns false for undefined and object", () => {
    const obj = { a: 1 };
    expect(shallow(obj, undefined as any)).toBe(false);
    expect(shallow(undefined as any, obj)).toBe(false);
  });

  test("returns false for equalish object and array", () => {
    const obj = { "0": 1, "1": 2 };
    const arr = [1, 2] as any;
    expect(shallow(obj, arr)).toBe(false);
    expect(shallow(arr, obj)).toBe(false);
  });

  test("returns true for arrays with same elements", () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    expect(shallow(arr1, arr2)).toBe(true);
    expect(shallow(arr2, arr1)).toBe(true);
  });

  test("returns false for arrays with different elements", () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 4];
    expect(shallow(arr1, arr2)).toBe(false);
    expect(shallow(arr2, arr1)).toBe(false);
  });

  test("handles nested objects (shallow only)", () => {
    const nested = { value: 1 };
    const obj1 = { nested };
    const obj2 = { nested };
    expect(shallow(obj1, obj2)).toBe(true);
    expect(shallow(obj2, obj1)).toBe(true);

    const obj3 = { nested: { value: 1 } };
    expect(shallow(obj1, obj3)).toBe(false);
    expect(shallow(obj3, obj1)).toBe(false);
  });

  test("handles nested arrays (shallow only)", () => {
    const arr1 = { nested: [1, 2, 3] };
    const arr2 = { nested: [1, 2, 3] };
    expect(shallow(arr1, arr2)).toBe(false);
    expect(shallow(arr2, arr1)).toBe(false);
  });

  test("returns false for properties with different types", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: "1" } as any;
    expect(shallow(obj1, obj2)).toBe(false);
    expect(shallow(obj2, obj1)).toBe(false);
  });
});

describe("slice", () => {
  test("returns a function", () => {
    const slicer = slice<any, any>(
      state => state.count,
      () => {}
    );
    expect(typeof slicer).toBe("function");
  });

  test("calls callback when selected slice changes", () => {
    const callback = mock();
    const store = create({ count: 0, other: "unchanged" });

    store.subscribe(slice(state => state.count, callback));
    store.set({ count: 1, other: "unchanged" });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  test("doesn't call callback when selected slice doesn't change", () => {
    const callback = mock();
    const store = create({ count: 0, other: "changed" });

    store.subscribe(slice(state => state.count, callback));
    store.set({ count: 0, other: "changed again" });

    expect(callback).not.toHaveBeenCalled();
  });

  test("works with different selectors", () => {
    const callback = mock();
    const store = create({ user: { name: "John", age: 30 }, other: "data" });

    store.subscribe(slice(state => state.user.name, callback));

    store.set({ user: { name: "John", age: 30 }, other: "other data" });
    expect(callback).not.toHaveBeenCalled();

    store.set({ user: { name: "Jane", age: 30 }, other: "data" });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("Jane", "John");
  });

  test("uses custom equality function when provided", () => {
    const callback = mock();
    const customEquality = mock(() => true);
    const store = create({ count: 0 });

    store.subscribe(
      slice(state => state.count, callback, { isEqual: customEquality })
    );
    store.set({ count: 1 });

    expect(customEquality).toHaveBeenCalledWith(1, 0);
    expect(callback).not.toHaveBeenCalled();
  });

  test("calls callback when custom equality returns false", () => {
    const callback = mock();
    const customEquality = mock(() => false);
    const store = create({ count: 0 });

    store.subscribe(
      slice(state => state.count, callback, { isEqual: customEquality })
    );
    store.set({ count: 0 });

    expect(customEquality).toHaveBeenCalledWith(0, 0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(0, 0);
  });

  test("works with shallow equality function", () => {
    const callback = mock();
    const store = create({ user: { name: "John", age: 30 } });

    store.subscribe(slice(state => state.user, callback, { isEqual: shallow }));

    store.set({ user: { name: "John", age: 30 } });
    expect(callback).not.toHaveBeenCalled();

    store.set({ user: { name: "Jane", age: 30 } });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      { name: "Jane", age: 30 },
      { name: "John", age: 30 }
    );
  });

  test("defaults to Object.is for equality when no custom equality provided", () => {
    const callback = mock();
    const store = create({ count: NaN });

    store.subscribe(slice(state => state.count, callback));
    store.set({ count: NaN });

    expect(callback).not.toHaveBeenCalled();
  });

  test("works with primitive state", () => {
    const callback = mock();
    const store = create(0);

    store.subscribe(slice(state => state, callback));
    store.set(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  test("passes correct previous slice value", () => {
    const callback = mock();
    const store = create({ value: "first" });

    store.subscribe(slice(state => state.value, callback));
    store.set({ value: "second" });
    store.set({ value: "third" });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, "second", "first");
    expect(callback).toHaveBeenNthCalledWith(2, "third", "second");
  });

  test("unsubscribe works correctly", () => {
    const callback = mock();
    const store = create({ count: 0 });

    const unsubscribe = store.subscribe(slice(state => state.count, callback));
    store.set({ count: 1 });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set({ count: 2 });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
