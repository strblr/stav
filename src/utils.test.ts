import { test, expect, mock, describe } from "bun:test";
import {
  assign,
  pick,
  omit,
  shallow,
  slice,
  createScope,
  deep,
  debounce
} from "./utils";

describe("assign", () => {
  test("assigns properties from the second object to the first", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 3, c: 4 };
    const result = assign(obj1, obj2);
    expect(result).toEqual({ a: 3, b: 2, c: 4 });
  });

  test("mutates and returns the first object", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    const result = assign(obj1, obj2);
    expect(result).toBe(obj1);
    expect(obj1).toEqual({ a: 2 });
  });
});

describe("pick", () => {
  test("returns a new object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ["a", "c"]);
    expect(result).not.toBe(obj);
  });

  test("picks specified properties from object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ["a", "c"]);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test("returns empty object when picking no keys", () => {
    const obj = { a: 1, b: 2 };
    const result = pick(obj, []);
    expect(result).toEqual({});
  });

  test("picks single property", () => {
    const obj = { name: "John", age: 30, city: "NYC" };
    const result = pick(obj, ["name"]);
    expect(result).toEqual({ name: "John" });
  });

  test("does not mutate original object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    pick(obj, ["a"]);
    expect(obj).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe("omit", () => {
  test("returns a new object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ["b", "c"]);
    expect(result).not.toBe(obj);
  });

  test("omits specified properties from object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ["b"]);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test("returns copy when omitting no keys", () => {
    const obj = { a: 1, b: 2 };
    const result = omit(obj, []);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test("omits multiple properties", () => {
    const obj = { name: "John", age: 30, city: "NYC", country: "USA" };
    const result = omit(obj, ["age", "country"]);
    expect(result).toEqual({ name: "John", city: "NYC" });
  });

  test("does not mutate original object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    omit(obj, ["b"]);
    expect(obj).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe("createScope", () => {
  test("returns object with get, set and act methods", () => {
    const scope = createScope(42);
    expect(scope.get).toBeFunction();
    expect(scope.set).toBeFunction();
    expect(scope.act).toBeFunction();
  });

  test("get returns initial value", () => {
    const scope = createScope("initial");
    expect(scope.get()).toBe("initial");
  });

  test("act temporarily changes value and restores it", () => {
    const scope = createScope("original");
    expect(scope.get()).toBe("original");

    scope.act("temporary", () => {
      expect(scope.get()).toBe("temporary");
    });

    expect(scope.get()).toBe("original");
  });

  test("act returns result of callback", () => {
    const scope = createScope(0);
    const result = scope.act(5, () => "callback result");
    expect(result).toBe("callback result");
  });

  test("act restores value even when callback throws", () => {
    const scope = createScope("safe");

    expect(() => {
      scope.act("dangerous", () => {
        throw new Error("test error");
      });
    }).toThrow("test error");

    expect(scope.get()).toBe("safe");
  });

  test("nested scopes work correctly", () => {
    const scope = createScope("level0");

    scope.act("level1", () => {
      expect(scope.get()).toBe("level1");
      scope.act("level2", () => {
        expect(scope.get()).toBe("level2");
      });
      expect(scope.get()).toBe("level1");
    });

    expect(scope.get()).toBe("level0");
  });

  test("set permanently changes the value", () => {
    const scope = createScope("original");

    expect(scope.get()).toBe("original");

    scope.set("new value");
    expect(scope.get()).toBe("new value");

    scope.act("temporary", () => {
      expect(scope.get()).toBe("temporary");
    });

    expect(scope.get()).toBe("new value");
  });
});

describe("slice", () => {
  test("returns a function", () => {
    const slicer = slice(
      state => state,
      () => {}
    );
    expect(slicer).toBeFunction();
  });

  test("calls callback when selected slice changes", () => {
    const callback = mock();
    const slicer = slice(
      (state: { count: number; other: string }) => state.count,
      callback
    );

    slicer({ count: 1, other: "unchanged" }, { count: 0, other: "unchanged" });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  test("doesn't call callback when selected slice doesn't change", () => {
    const callback = mock();
    const slicer = slice(
      (state: { count: number; other: string }) => state.count,
      callback
    );

    slicer(
      { count: 0, other: "changed again" },
      { count: 0, other: "changed" }
    );
    expect(callback).not.toHaveBeenCalled();
  });

  test("works with different selectors", () => {
    const callback = mock();
    const slicer = slice(
      (state: { user: { name: string; age: number }; other: string }) =>
        state.user.name,
      callback
    );

    slicer(
      { user: { name: "John", age: 30 }, other: "other data" },
      { user: { name: "John", age: 30 }, other: "data" }
    );
    expect(callback).not.toHaveBeenCalled();

    slicer(
      { user: { name: "Jane", age: 30 }, other: "data" },
      { user: { name: "John", age: 30 }, other: "data" }
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("Jane", "John");
  });

  test("uses custom equality function when provided", () => {
    const callback = mock();
    const customEquality = mock(() => true);
    const slicer = slice(
      (state: { count: number }) => state.count,
      callback,
      customEquality
    );

    slicer({ count: 1 }, { count: 0 });
    expect(customEquality).toHaveBeenCalledWith(0, 1);
    expect(callback).not.toHaveBeenCalled();
  });

  test("calls callback when custom equality returns false", () => {
    const callback = mock();
    const customEquality = mock(() => false);
    const slicer = slice(
      (state: { count: number }) => state.count,
      callback,
      customEquality
    );

    slicer({ count: 0 }, { count: 0 });
    expect(customEquality).toHaveBeenCalledWith(0, 0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(0, 0);
  });

  test("works with shallow equality function", () => {
    const callback = mock();
    const slicer = slice(
      (state: { user: { name: string; age: number } }) => state.user,
      callback,
      shallow
    );

    slicer(
      { user: { name: "John", age: 30 } },
      { user: { name: "John", age: 30 } }
    );
    expect(callback).not.toHaveBeenCalled();

    slicer(
      { user: { name: "Jane", age: 30 } },
      { user: { name: "John", age: 30 } }
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      { name: "Jane", age: 30 },
      { name: "John", age: 30 }
    );
  });

  test("defaults to Object.is for equality when no custom equality provided", () => {
    const callback = mock();
    const slicer = slice((state: { count: number }) => state.count, callback);

    slicer({ count: NaN }, { count: NaN });
    expect(callback).not.toHaveBeenCalled();
  });

  test("works with primitive state", () => {
    const callback = mock();
    const slicer = slice((state: number) => state, callback);

    slicer(1, 0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  test("passes correct previous slice value", () => {
    const callback = mock();
    const slicer = slice((state: { value: string }) => state.value, callback);

    slicer({ value: "second" }, { value: "first" });
    slicer({ value: "third" }, { value: "second" });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, "second", "first");
    expect(callback).toHaveBeenNthCalledWith(2, "third", "second");
  });
});

describe("debounce", () => {
  test("returns a function", () => {
    const fn = mock();
    const debounced = debounce(fn, 10);
    expect(debounced).toBeFunction();
  });

  test("has a cancel method", () => {
    const fn = mock();
    const debounced = debounce(fn, 10);
    expect(debounced.cancel).toBeFunction();
  });

  test("delays function execution", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);

    debounced(1);
    expect(fn).not.toHaveBeenCalled();

    await sleep(15);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  test("only executes last call after multiple rapid calls", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);

    debounced(1);
    debounced(2);
    await sleep(5);
    debounced(3);
    debounced(4);
    expect(fn).not.toHaveBeenCalled();

    await sleep(15);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(4);
  });

  test("allows multiple independent executions after delay", async () => {
    const fn = mock();
    const debounced = debounce(fn, 5);

    debounced("first");
    await sleep(10);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");

    debounced("second");
    await sleep(10);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("second");
  });

  test("cancel prevents function execution", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);

    debounced(1);
    debounced.cancel();

    await sleep(15);
    expect(fn).not.toHaveBeenCalled();
  });

  test("cancel can be called multiple times safely", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);

    debounced(1);
    debounced.cancel();
    debounced.cancel();
    debounced.cancel();

    await sleep(15);
    expect(fn).not.toHaveBeenCalled();
  });

  test("cancel works in the middle of debounce sequence", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);

    debounced(1);
    debounced(2);
    debounced.cancel();
    debounced(3);

    await sleep(15);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  test("cancel can be called when no pending execution", () => {
    const fn = mock();
    const debounced = debounce(fn, 10);
    expect(() => debounced.cancel()).not.toThrow();
  });

  test("works with multiple arguments", async () => {
    const fn = mock();
    const debounced = debounce(fn, 10);
    debounced("a", "b", "c");

    await sleep(15);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a", "b", "c");
  });

  test("works with zero delay", async () => {
    const fn = mock();
    const debounced = debounce(fn, 0);

    debounced(1);
    expect(fn).not.toHaveBeenCalled();

    await sleep(0);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });
});

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

  test("returns false for arrays with different lengths", () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3, 4];
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

describe("deep", () => {
  test("returns true for same object reference", () => {
    const obj = { a: 1 };
    expect(deep(obj, obj)).toBe(true);
  });

  test("returns true for deeply equal objects", () => {
    const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
    const obj2 = { a: 1, b: { c: 2, d: { e: 3 } } };
    expect(deep(obj1, obj2)).toBe(true);
    expect(deep(obj2, obj1)).toBe(true);
  });

  test("returns false for objects with different nested values", () => {
    const obj1 = { a: 1, b: { c: { d: { e: 2 } } } };
    const obj2 = { a: 1, b: { c: { d: { e: 3 } } } };
    expect(deep(obj1, obj2)).toBe(false);
    expect(deep(obj2, obj1)).toBe(false);
  });

  test("returns false for objects with different keys", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 1, b: 2 };
    expect(deep(obj1, obj2)).toBe(false);
    expect(deep(obj2, obj1)).toBe(false);
  });

  test("returns false for null and object", () => {
    const obj = { a: 1 };
    expect(deep(obj, null as any)).toBe(false);
    expect(deep(null as any, obj)).toBe(false);
  });

  test("returns false for undefined and object", () => {
    const obj = { a: 1 };
    expect(deep(obj, undefined as any)).toBe(false);
    expect(deep(undefined as any, obj)).toBe(false);
  });

  test("returns false for object and array", () => {
    const obj = { "0": 1, "1": 2 };
    const arr = [1, 2] as any;
    expect(deep(obj, arr)).toBe(false);
    expect(deep(arr, obj)).toBe(false);
  });

  test("returns true for deeply equal arrays", () => {
    const arr1 = [1, [2, 3], [4, [5, 6]]];
    const arr2 = [1, [2, 3], [4, [5, 6]]];
    expect(deep(arr1, arr2)).toBe(true);
    expect(deep(arr2, arr1)).toBe(true);
  });

  test("returns false for arrays with different nested elements", () => {
    const arr1 = [1, [2, 3], [4, [5, 6]]];
    const arr2 = [1, [2, 3], [4, [5, 7]]];
    expect(deep(arr1, arr2)).toBe(false);
    expect(deep(arr2, arr1)).toBe(false);
  });

  test("returns false for arrays with different lengths", () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3, 4];
    expect(deep(arr1, arr2)).toBe(false);
    expect(deep(arr2, arr1)).toBe(false);
  });

  test("handles arrays nested in objects", () => {
    const obj1 = { nested: [1, 2, 3] };
    const obj2 = { nested: [1, 2, 3] };
    expect(deep(obj1, obj2)).toBe(true);
    expect(deep(obj2, obj1)).toBe(true);

    const obj3 = { nested: [1, 2, 4] };
    expect(deep(obj1, obj3)).toBe(false);
    expect(deep(obj3, obj1)).toBe(false);
  });

  test("handles objects nested in arrays", () => {
    const arr1 = [{ x: 1 }, { y: 2 }];
    const arr2 = [{ x: 1 }, { y: 2 }];
    expect(deep(arr1, arr2)).toBe(true);
    expect(deep(arr2, arr1)).toBe(true);

    const arr3 = [{ x: 1 }, { y: 3 }];
    expect(deep(arr1, arr3)).toBe(false);
    expect(deep(arr3, arr1)).toBe(false);
  });

  test("returns true for equal Date objects", () => {
    const date1 = new Date("2024-01-01");
    const date2 = new Date("2024-01-01");
    expect(deep(date1, date2)).toBe(true);
    expect(deep(date2, date1)).toBe(true);
  });

  test("returns false for different Date objects", () => {
    const date1 = new Date("2024-01-01");
    const date2 = new Date("2024-01-02");
    expect(deep(date1, date2)).toBe(false);
    expect(deep(date2, date1)).toBe(false);
  });

  test("returns true for equal RegExp objects", () => {
    const regex1 = /test/gi;
    const regex2 = /test/gi;
    expect(deep(regex1, regex2)).toBe(true);
    expect(deep(regex2, regex1)).toBe(true);
  });

  test("returns false for RegExp with different patterns", () => {
    const regex1 = /test/gi;
    const regex2 = /other/gi;
    expect(deep(regex1, regex2)).toBe(false);
    expect(deep(regex2, regex1)).toBe(false);
  });

  test("returns false for RegExp with different flags", () => {
    const regex1 = /test/gi;
    const regex2 = /test/g;
    expect(deep(regex1, regex2)).toBe(false);
    expect(deep(regex2, regex1)).toBe(false);
  });

  test("returns true for equal Error objects", () => {
    const error1 = new Error("test message", { cause: { a: 1 } });
    const error2 = new Error("test message", { cause: { a: 1 } });
    expect(deep(error1, error2)).toBe(true);
    expect(deep(error2, error1)).toBe(true);
    const error3 = new TypeError("test");
    const error4 = new TypeError("test");
    expect(deep(error3, error4)).toBe(true);
    expect(deep(error4, error3)).toBe(true);
  });

  test("returns false for Error objects from different constructors", () => {
    const error1 = new Error("test message");
    const error2 = new RangeError("test message");
    expect(deep(error1, error2)).toBe(false);
    expect(deep(error2, error1)).toBe(false);
  });

  test("returns false for Error objects with different names", () => {
    const error1 = new Error("test message");
    error1.name = "Error";
    const error2 = new Error("test message");
    error2.name = "Error2";
    expect(deep(error1, error2)).toBe(false);
    expect(deep(error2, error1)).toBe(false);
  });

  test("returns false for Error objects with different messages", () => {
    const error1 = new Error("test message", { cause: { a: 1 } });
    const error2 = new Error("different message", { cause: { a: 1 } });
    expect(deep(error1, error2)).toBe(false);
    expect(deep(error2, error1)).toBe(false);
  });

  test("returns false for Error objects with different causes", () => {
    const error1 = new Error("test message", { cause: { a: 1 } });
    const error2 = new Error("test message", { cause: { a: 2 } });
    expect(deep(error1, error2)).toBe(false);
    expect(deep(error2, error1)).toBe(false);
  });

  test("returns true for primitives with Object.is semantics", () => {
    expect(deep(NaN, NaN)).toBe(true);
    expect(deep(42, 42)).toBe(true);
    expect(deep("test", "test")).toBe(true);
    expect(deep(true, true)).toBe(true);
    expect(deep(null, null)).toBe(true);
    expect(deep(undefined, undefined)).toBe(true);
    expect(deep(Infinity, Infinity)).toBe(true);
    expect(deep(-Infinity, -Infinity)).toBe(true);
  });

  test("returns false for different primitive types", () => {
    expect(deep(0, -0)).toBe(false);
    expect(deep(-0, 0)).toBe(false);
    expect(deep(1, "1" as any)).toBe(false);
    expect(deep(true, 1 as any)).toBe(false);
    expect(deep(null, undefined as any)).toBe(false);
    expect(deep(Infinity, -Infinity)).toBe(false);
  });

  describe("Map", () => {
    test("returns true for equal Map objects", () => {
      const map1 = new Map([
        ["a", 1],
        ["b", 2]
      ]);
      const map2 = new Map([
        ["a", 1],
        ["b", 2]
      ]);
      expect(deep(map1, map2)).toBe(true);
      expect(deep(map2, map1)).toBe(true);
    });

    test("returns false for Map objects with different sizes", () => {
      const map1 = new Map([["a", 1]]);
      const map2 = new Map([
        ["a", 1],
        ["b", 2]
      ]);
      expect(deep(map1, map2)).toBe(false);
      expect(deep(map2, map1)).toBe(false);
    });

    test("returns false for Map objects with different keys", () => {
      const map1 = new Map([["a", 1]]);
      const map2 = new Map([["b", 1]]);
      expect(deep(map1, map2)).toBe(false);
      expect(deep(map2, map1)).toBe(false);
    });

    test("returns false for Map objects with different values", () => {
      const map1 = new Map([["a", 1]]);
      const map2 = new Map([["a", 2]]);
      expect(deep(map1, map2)).toBe(false);
      expect(deep(map2, map1)).toBe(false);
    });

    test("returns true for Map objects with nested equal values", () => {
      const map1 = new Map([["a", { nested: [1, 2, 3] }]]);
      const map2 = new Map([["a", { nested: [1, 2, 3] }]]);
      expect(deep(map1, map2)).toBe(true);
      expect(deep(map2, map1)).toBe(true);
    });

    test("returns false for Map objects with nested different values", () => {
      const map1 = new Map([["a", { nested: [1, 2, 3] }]]);
      const map2 = new Map([["a", { nested: [1, 2, 4] }]]);
      expect(deep(map1, map2)).toBe(false);
      expect(deep(map2, map1)).toBe(false);
    });
  });

  describe("Set", () => {
    test("returns true for equal Set objects", () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      expect(deep(set1, set2)).toBe(true);
      expect(deep(set2, set1)).toBe(true);
    });

    test("returns false for Set objects with different sizes", () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([1, 2, 3]);
      expect(deep(set1, set2)).toBe(false);
      expect(deep(set2, set1)).toBe(false);
    });

    test("returns false for Set objects with different values", () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 4]);
      expect(deep(set1, set2)).toBe(false);
      expect(deep(set2, set1)).toBe(false);
    });

    test("returns true for Set objects with same object keys", () => {
      const obj = { value: 1 };
      const obj2 = { value: 2 };
      const set1 = new Set([obj, obj2]);
      const set2 = new Set([obj, obj2]);
      expect(deep(set1, set2)).toBe(true);
      expect(deep(set2, set1)).toBe(true);
    });

    test("returns false for Set objects with different object keys", () => {
      const obj = { value: 1 };
      const obj2 = { value: 2 };
      const set1 = new Set([obj, obj2]);
      const set2 = new Set([obj, { ...obj2 }]);
      expect(deep(set1, set2)).toBe(false);
      expect(deep(set2, set1)).toBe(false);
    });
  });

  describe("TypedArrays", () => {
    test("returns true for equal Int8Array objects", () => {
      const arr1 = new Int8Array([1, 2, 3, 4]);
      const arr2 = new Int8Array([1, 2, 3, 4]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns false for different Int8Array objects", () => {
      const arr1 = new Int8Array([1, 2, 3]);
      const arr2 = new Int8Array([1, 2, 4]);
      expect(deep(arr1, arr2)).toBe(false);
      expect(deep(arr2, arr1)).toBe(false);
    });

    test("returns false for Int8Array objects with different lengths", () => {
      const arr1 = new Int8Array([1, 2, 3]);
      const arr2 = new Int8Array([1, 2, 3, 4]);
      expect(deep(arr1, arr2)).toBe(false);
      expect(deep(arr2, arr1)).toBe(false);
    });

    test("returns true for equal Uint8Array objects", () => {
      const arr1 = new Uint8Array([1, 2, 3, 4]);
      const arr2 = new Uint8Array([1, 2, 3, 4]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Uint8ClampedArray objects", () => {
      const arr1 = new Uint8ClampedArray([0, 127, 255]);
      const arr2 = new Uint8ClampedArray([0, 127, 255]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Int16Array objects", () => {
      const arr1 = new Int16Array([1000, -1000, 2000]);
      const arr2 = new Int16Array([1000, -1000, 2000]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Uint16Array objects", () => {
      const arr1 = new Uint16Array([1000, 2000, 3000]);
      const arr2 = new Uint16Array([1000, 2000, 3000]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Int32Array objects", () => {
      const arr1 = new Int32Array([100000, -100000, 200000]);
      const arr2 = new Int32Array([100000, -100000, 200000]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Uint32Array objects", () => {
      const arr1 = new Uint32Array([100000, 200000, 300000]);
      const arr2 = new Uint32Array([100000, 200000, 300000]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Float32Array objects", () => {
      const arr1 = new Float32Array([1.5, 2.5, 3.5]);
      const arr2 = new Float32Array([1.5, 2.5, 3.5]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal Float64Array objects", () => {
      const arr1 = new Float64Array([1.5, 2.5, 3.5]);
      const arr2 = new Float64Array([1.5, 2.5, 3.5]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal BigInt64Array objects", () => {
      const arr1 = new BigInt64Array([1n, 2n, 3n]);
      const arr2 = new BigInt64Array([1n, 2n, 3n]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns true for equal BigUint64Array objects", () => {
      const arr1 = new BigUint64Array([1n, 2n, 3n]);
      const arr2 = new BigUint64Array([1n, 2n, 3n]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("returns false for different Float32Array objects", () => {
      const arr1 = new Float32Array([1.5, 2.5, 3.5]);
      const arr2 = new Float32Array([1.5, 2.5, 3.6]);
      expect(deep(arr1, arr2)).toBe(false);
      expect(deep(arr2, arr1)).toBe(false);
    });

    test("returns false for TypedArrays with different types but same values", () => {
      const arr1 = new Int32Array([1, 2, 3]);
      const arr2 = new Uint32Array([1, 2, 3]);
      expect(deep(arr1 as any, arr2 as any)).toBe(false);
      expect(deep(arr2 as any, arr1 as any)).toBe(false);
    });

    test("returns true for equal DataView objects", () => {
      const buffer1 = new ArrayBuffer(8);
      const view1 = new DataView(buffer1);
      view1.setInt32(0, 42);
      view1.setFloat32(4, 3.14);

      const buffer2 = new ArrayBuffer(8);
      const view2 = new DataView(buffer2);
      view2.setInt32(0, 42);
      view2.setFloat32(4, 3.14);

      expect(deep(view1, view2)).toBe(true);
      expect(deep(view2, view1)).toBe(true);
    });

    test("returns false for different DataView objects", () => {
      const buffer1 = new ArrayBuffer(8);
      const view1 = new DataView(buffer1);
      view1.setInt32(0, 42);

      const buffer2 = new ArrayBuffer(8);
      const view2 = new DataView(buffer2);
      view2.setInt32(0, 43);

      expect(deep(view1, view2)).toBe(false);
      expect(deep(view2, view1)).toBe(false);
    });

    test("handles TypedArrays with views on same buffer", () => {
      const buffer = new ArrayBuffer(16);
      const arr1 = new Int32Array(buffer, 0, 4);
      arr1.set([1, 2, 3, 4]);
      const arr2 = new Int32Array(buffer, 0, 4);

      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });

    test("handles TypedArrays with different offsets", () => {
      const buffer1 = new ArrayBuffer(16);
      const arr1 = new Int32Array(buffer1, 4, 2);
      arr1.set([1, 2]);

      const buffer2 = new ArrayBuffer(16);
      const arr2 = new Int32Array(buffer2, 0, 2);
      arr2.set([1, 2]);

      expect(deep(arr1, arr2)).toBe(false);
      expect(deep(arr2, arr1)).toBe(false);
    });

    test("handles TypedArrays nested in objects", () => {
      const obj1 = { data: new Uint8Array([1, 2, 3]) };
      const obj2 = { data: new Uint8Array([1, 2, 3]) };
      expect(deep(obj1, obj2)).toBe(true);
      expect(deep(obj2, obj1)).toBe(true);

      const obj3 = { data: new Uint8Array([1, 2, 4]) };
      expect(deep(obj1, obj3)).toBe(false);
      expect(deep(obj3, obj1)).toBe(false);
    });

    test("handles empty TypedArrays", () => {
      const arr1 = new Uint8Array([]);
      const arr2 = new Uint8Array([]);
      expect(deep(arr1, arr2)).toBe(true);
      expect(deep(arr2, arr1)).toBe(true);
    });
  });

  test("handles complex nested structures", () => {
    const complex1 = {
      arr: [1, 2, { nested: "value" }],
      obj: { a: 1, b: { c: 2 } },
      date: new Date("2024-01-01"),
      regex: /test/gi,
      map: new Map([["key", { value: 1 }]]),
      set: new Set([1, 2, 3]),
      int8Array: new Int8Array([1, 2, 3])
    };
    const complex2 = {
      arr: [1, 2, { nested: "value" }],
      obj: { a: 1, b: { c: 2 } },
      date: new Date("2024-01-01"),
      regex: /test/gi,
      map: new Map([["key", { value: 1 }]]),
      set: new Set([1, 2, 3]),
      int8Array: new Int8Array([1, 2, 3])
    };
    expect(deep(complex1, complex2)).toBe(true);
    expect(deep(complex2, complex1)).toBe(true);
  });

  test("detects differences in complex nested structures", () => {
    const complex1 = {
      arr: [1, 2, { nested: "value" }],
      map: new Map([["key", { value: 1 }]]),
      Int32Array: new Int32Array([1, 2, 3])
    };
    const complex2 = {
      arr: [1, 2, { nested: "value" }],
      map: new Map([["key", { value: 2 }]]),
      Int32Array: new Int32Array([1, 2, 3])
    };
    expect(deep(complex1, complex2)).toBe(false);
    expect(deep(complex2, complex1)).toBe(false);
  });
});

// Utils

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
