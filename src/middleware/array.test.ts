import { test, expect, describe } from "bun:test";
import { create } from "../create";
import { array } from "./array";

describe("array middleware", () => {
  test("adds array methods to store", () => {
    const store = array(create([1, 2, 3]));

    expect(store.push).toBeFunction();
    expect(store.unshift).toBeFunction();
    expect(store.concat).toBeFunction();
    expect(store.filter).toBeFunction();
    expect(store.map).toBeFunction();
    expect(store.reverse).toBeFunction();
    expect(store.sort).toBeFunction();
    expect(store.slice).toBeFunction();
  });

  test("preserves store functionality", () => {
    const store = array(create([1, 2, 3]));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();

    store.set([4, 5, 6]);
    expect(store.get()).toEqual([4, 5, 6]);
  });

  test("works with empty array", () => {
    const store = array(create<number[]>([]));

    store.push(1, 2, 3);
    expect(store.get()).toEqual([1, 2, 3]);

    store.filter(() => true);
    expect(store.get()).toEqual([1, 2, 3]);
  });

  test("push adds items to end", () => {
    const store = array(create([1, 2]));
    store.push(3, 4);
    expect(store.get()).toEqual([1, 2, 3, 4]);
  });

  test("push with no items does nothing", () => {
    const store = array(create([1, 2, 3]));
    store.push();
    expect(store.get()).toEqual([1, 2, 3]);
    expect(store.get()).toBe(store.get.initial());
  });

  test("unshift adds items to start", () => {
    const store = array(create([3, 4]));
    store.unshift(1, 2);
    expect(store.get()).toEqual([1, 2, 3, 4]);
  });

  test("unshift with no items does nothing", () => {
    const store = array(create([1, 2, 3]));
    store.unshift();
    expect(store.get()).toEqual([1, 2, 3]);
    expect(store.get()).toBe(store.get.initial());
  });

  test("concat merges arrays", () => {
    const store = array(create([1, 2]));
    store.concat([3, 4], [5, 6]);
    expect(store.get()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("concat with no arrays does nothing", () => {
    const store = array(create([1, 2, 3]));
    store.concat();
    expect(store.get()).toEqual([1, 2, 3]);
    expect(store.get()).toBe(store.get.initial());
  });

  test("filter removes items that don't match predicate", () => {
    const store = array(create([1, 2, 3, 4, 5, 6]));
    store.filter(n => n % 2 === 0);
    expect(store.get()).toEqual([2, 4, 6]);
  });

  test("filter with predicate that removes all items", () => {
    const store = array(create([1, 2, 3]));
    store.filter(() => false);
    expect(store.get()).toEqual([]);
  });

  test("map transforms each item", () => {
    const store = array(create([1, 2, 3]));
    store.map(n => n * 2);
    expect(store.get()).toEqual([2, 4, 6]);
  });

  test("reverse reverses array order", () => {
    const store = array(create([1, 2, 3, 4]));
    store.reverse();
    expect(store.get()).toEqual([4, 3, 2, 1]);
    expect(store.get.initial()).toEqual([1, 2, 3, 4]);
  });

  test("sort sorts array", () => {
    const store = array(create([3, 1, 4, 1, 5]));
    store.sort();
    expect(store.get()).toEqual([1, 1, 3, 4, 5]);
    expect(store.get.initial()).toEqual([3, 1, 4, 1, 5]);
  });

  test("sort with custom comparator", () => {
    const store = array(create([3, 1, 4, 1, 5]));
    store.sort((a, b) => b - a);
    expect(store.get()).toEqual([5, 4, 3, 1, 1]);
  });

  test("slice extracts portion of array", () => {
    const store = array(create([0, 1, 2, 3, 4, 5]));
    store.slice(2, 5);
    expect(store.get()).toEqual([2, 3, 4]);
    expect(store.get.initial()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("slice with start only", () => {
    const store = array(create([0, 1, 2, 3, 4, 5]));
    store.slice(3);
    expect(store.get()).toEqual([3, 4, 5]);
  });

  test("slice with negative indices", () => {
    const store = array(create([0, 1, 2, 3, 4, 5]));
    store.slice(-3, -1);
    expect(store.get()).toEqual([3, 4]);
  });

  test("slice with no arguments", () => {
    const store = array(create([0, 1, 2, 3, 4, 5]));
    store.slice();
    expect(store.get()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(store.get()).not.toBe(store.get.initial());
  });

  test("works with objects", () => {
    const store = array(create([{ id: 1 }, { id: 2 }]));

    store.push({ id: 3 });
    expect(store.get()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

    store.filter(item => item.id > 1);
    expect(store.get()).toEqual([{ id: 2 }, { id: 3 }]);
  });
});
