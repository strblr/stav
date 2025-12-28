import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { entangle } from "./entangle";
import { array } from "./array";
import { object } from "./object";
import { transaction } from "../transaction";

describe("entangle", () => {
  test("returns the original store", () => {
    const storeA = create(0);
    const storeB = create(0);

    const result = entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    expect(result).toBe(storeA);
  });

  test("preserves store functionality after entangle", () => {
    const storeA = create(0);
    const storeB = create(0);

    const result = entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    expect(result.get).toBeFunction();
    expect(result.set).toBeFunction();
    expect(result.subscribe).toBeFunction();
    expect(result.getInitial).toBeFunction();
  });

  test("syncs on setup", () => {
    const storeA = create(5);
    const storeB = create(10);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState * 2,
      set: state => state / 2
    });

    expect(storeA.get()).toBe(20);
  });

  test("syncs state from paired store to main store", () => {
    const storeA = create(5);
    const storeB = create(10);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState * 2,
      set: state => state / 2
    });

    storeB.set(20);
    expect(storeA.get()).toBe(40);
  });

  test("syncs state from main store to paired store", () => {
    const storeA = create(5);
    const storeB = create(10);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState * 2,
      set: state => state / 2
    });

    storeA.set(30);
    expect(storeB.get()).toBe(15);
  });

  test("bidirectional sync maintains consistency", () => {
    const storeA = create(0);
    const storeB = create(0);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    storeA.set(5);
    expect(storeB.get()).toBe(5);

    storeB.set(10);
    expect(storeA.get()).toBe(10);
  });

  test("prevents infinite loops during sync", () => {
    const storeA = create(0);
    const storeB = create(0);
    const listenerA = mock();
    const listenerB = mock();

    storeA.subscribe(listenerA);
    storeB.subscribe(listenerB);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    storeA.set(5);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  test("syncs with complex transformation", () => {
    const celsius = create(0);
    const fahrenheit = create(32);

    entangle(celsius, {
      with: fahrenheit,
      get: f => ((f - 32) * 5) / 9,
      set: c => (c * 9) / 5 + 32
    });

    celsius.set(100);
    expect(fahrenheit.get()).toBe(212);

    fahrenheit.set(32);
    expect(celsius.get()).toBe(0);
  });

  test("uses current state in get transformation", () => {
    const storeA = create(10);
    const storeB = create(5);

    entangle(storeA, {
      with: storeB,
      get: (pairedState, state) => pairedState + state,
      set: state => state
    });

    expect(storeA.get()).toBe(15);

    storeB.set(3);
    expect(storeA.get()).toBe(18);
  });

  test("entangles object property with primitive store", () => {
    const counter = create(0);
    const state = object(create({ count: 0, name: "test" }));

    entangle(counter, {
      with: state,
      get: obj => obj.count,
      set: (value, obj) => ({ ...obj, count: value })
    });

    counter.set(10);
    expect(state.get()).toEqual({ count: 10, name: "test" });

    state.assign({ count: 20 });
    expect(counter.get()).toBe(20);
  });

  test("entangles nested object properties", () => {
    const storeA = object(create({ user: { name: "Alice", age: 25 } }));
    const storeB = object(create({ profile: { name: "Bob", age: 30 } }));

    entangle(storeA, {
      with: storeB,
      get: b => ({ user: b.profile }),
      set: a => ({ profile: a.user })
    });

    storeA.assign({ user: { name: "Charlie", age: 35 } });
    expect(storeB.get().profile).toEqual({ name: "Charlie", age: 35 });

    storeB.assign({ profile: { name: "Diana", age: 28 } });
    expect(storeA.get().user).toEqual({ name: "Diana", age: 28 });
  });

  test("works with arrays", () => {
    const storeA = array(create([10, 20, 30]));
    const storeB = array(create([1, 2, 3]));

    entangle(storeA, {
      with: storeB,
      get: arr => arr.map(n => n * 10),
      set: arr => arr.map(n => n / 10)
    });

    storeA.set([40, 50]);
    expect(storeB.get()).toEqual([4, 5]);

    storeB.set([6, 7, 8]);
    expect(storeA.get()).toEqual([60, 70, 80]);
  });

  test("entangles array store with object property array", () => {
    const arrayStore = array(create([1, 2, 3]));
    const objectStore = object(
      create({ items: [1, 2, 3], meta: { count: 3 } })
    );

    entangle(arrayStore, {
      with: objectStore,
      get: obj => obj.items,
      set: (items, obj) => ({ ...obj, items })
    });

    arrayStore.set([4, 5, 6]);
    expect(objectStore.get().items).toEqual([4, 5, 6]);

    objectStore.assign({ items: [10, 20] });
    expect(arrayStore.get()).toEqual([10, 20]);

    arrayStore.push(30);
    expect(objectStore.get().items).toEqual([10, 20, 30]);

    objectStore.set(state => ({
      ...state,
      items: [...state.items, 40, 50]
    }));
    expect(arrayStore.get()).toEqual([10, 20, 30, 40, 50]);

    arrayStore.filter(n => n >= 30);
    expect(objectStore.get().items).toEqual([30, 40, 50]);
  });

  test("multiple stores can be entangled to the same paired store", () => {
    const main = object(create({ x: 0, y: 0 }));
    const xStore = create(0);
    const yStore = create(0);

    entangle(xStore, {
      with: main,
      get: state => state.x,
      set: (x, state) => ({ ...state, x })
    });

    entangle(yStore, {
      with: main,
      get: state => state.y,
      set: (y, state) => ({ ...state, y })
    });

    xStore.set(5);
    expect(main.get()).toEqual({ x: 5, y: 0 });

    yStore.set(10);
    expect(main.get()).toEqual({ x: 5, y: 10 });

    main.assign({ x: 20, y: 30 });
    expect(xStore.get()).toBe(20);
    expect(yStore.get()).toBe(30);
  });

  test("works with function state updates", () => {
    const storeA = create(0);
    const storeB = create(0);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    storeA.set(state => state + 5);
    expect(storeB.get()).toBe(5);

    storeB.set(state => state * 2);
    expect(storeA.get()).toBe(10);
  });
});

describe("integration", () => {
  test("works with transactions", () => {
    const storeA = create(0);
    const storeB = create(0);

    entangle(storeA, {
      with: storeB,
      get: pairedState => pairedState,
      set: state => state
    });

    transaction(() => {
      storeA.set(5);
      expect(storeB.get()).toBe(5);
      storeB.set(10);
      expect(storeA.get()).toBe(10);
    });

    expect(storeA.get()).toBe(10);
    expect(storeB.get()).toBe(10);
  });
});
