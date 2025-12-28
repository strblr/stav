import { test, expect, mock, describe, beforeEach, afterEach } from "bun:test";
import { create } from "../create";
import { entangle, derive } from "./entangle";
import { array } from "./array";
import { object } from "./object";
import { transaction } from "../transaction";

const consoleWarn = console.warn;

beforeEach(() => {
  console.warn = mock();
});

afterEach(() => {
  console.warn = consoleWarn;
});

describe("entangle", () => {
  test("returns the original store with untangle method", () => {
    const storeA = create(0);

    const result = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    expect(result.get).toBeFunction();
    expect(result.set).toBeFunction();
    expect(result.subscribe).toBeFunction();
    expect(result.untangle).toBeFunction();
  });

  test("preserves store functionality after entangle", () => {
    const storeA = create(0);

    const result = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    expect(result.get).toBeFunction();
    expect(result.set).toBeFunction();
    expect(result.subscribe).toBeFunction();
    expect(result.getInitial).toBeFunction();
    expect(result.untangle).toBeFunction();
  });

  test("syncs on setup", () => {
    const storeA = create(10);

    const storeB = entangle(create(5), {
      with: storeA,
      get: sourceState => sourceState * 2,
      set: state => state / 2
    });

    expect(storeB.get()).toBe(20);
  });

  test("syncs state from source store to store", () => {
    const storeA = create(10);

    const storeB = entangle(create(5), {
      with: storeA,
      get: sourceState => sourceState * 2,
      set: state => state / 2
    });

    storeA.set(20);
    expect(storeB.get()).toBe(40);
  });

  test("syncs state from store to source store", () => {
    const storeA = create(10);

    const storeB = entangle(create(5), {
      with: storeA,
      get: sourceState => sourceState * 2,
      set: state => state / 2
    });

    storeB.set(30);
    expect(storeA.get()).toBe(15);
  });

  test("bidirectional sync maintains consistency", () => {
    const storeA = create(0);

    const storeB = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    storeB.set(5);
    expect(storeA.get()).toBe(5);

    storeA.set(10);
    expect(storeB.get()).toBe(10);
  });

  test("prevents infinite loops during sync", () => {
    const storeA = create(0);
    const listenerA = mock();
    const listenerB = mock();

    storeA.subscribe(listenerA);

    const storeB = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    storeB.subscribe(listenerB);

    storeB.set(5);

    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledTimes(1);
  });

  test("syncs with complex transformation", () => {
    const celsius = create(0);
    const fahrenheit = entangle(create(32), {
      with: celsius,
      get: c => (c * 9) / 5 + 32,
      set: f => ((f - 32) * 5) / 9
    });

    celsius.set(100);
    expect(fahrenheit.get()).toBe(212);

    fahrenheit.set(32);
    expect(celsius.get()).toBe(0);
  });

  test("uses current state in get transformation", () => {
    const storeA = create(5);

    const storeB = entangle(create(10), {
      with: storeA,
      get: (sourceState, state) => sourceState + state,
      set: state => state
    });

    expect(storeB.get()).toBe(15);

    storeA.set(3);
    expect(storeB.get()).toBe(18);
  });

  test("entangles object property with primitive store", () => {
    const state = object(create({ count: 0, name: "test" }));

    const counter = entangle(create(0), {
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
    const storeA = object(create({ profile: { name: "Bob", age: 30 } }));

    const storeB = entangle(
      object(create({ user: { name: "Alice", age: 25 } })),
      {
        with: storeA,
        get: a => ({ user: a.profile }),
        set: b => ({ profile: b.user })
      }
    );

    storeB.assign({ user: { name: "Charlie", age: 35 } });
    expect(storeA.get().profile).toEqual({ name: "Charlie", age: 35 });

    storeA.assign({ profile: { name: "Diana", age: 28 } });
    expect(storeB.get().user).toEqual({ name: "Diana", age: 28 });
  });

  test("works with arrays", () => {
    const storeA = array(create([1, 2, 3]));

    const storeB = entangle(array(create([10, 20, 30])), {
      with: storeA,
      get: arr => arr.map(n => n * 10),
      set: arr => arr.map(n => n / 10)
    });

    storeB.set([40, 50]);
    expect(storeA.get()).toEqual([4, 5]);

    storeA.set([6, 7, 8]);
    expect(storeB.get()).toEqual([60, 70, 80]);
  });

  test("entangles array store with object property array", () => {
    const objectStore = object(
      create({ items: [1, 2, 3], meta: { count: 3 } })
    );

    const arrayStore = entangle(array(create([1, 2, 3])), {
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

  test("multiple stores can be entangled to the same source store", () => {
    const main = object(create({ x: 0, y: 0 }));

    const xStore = entangle(create(0), {
      with: main,
      get: state => state.x,
      set: (x, state) => ({ ...state, x })
    });

    const yStore = entangle(create(0), {
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

    const storeB = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    storeB.set(state => state + 5);
    expect(storeA.get()).toBe(5);

    storeA.set(state => state * 2);
    expect(storeB.get()).toBe(10);
  });

  test("untangle stops synchronization between stores", () => {
    const storeA = create(0);

    const entangled = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    const storeB = entangled;

    storeB.set(5);
    expect(storeA.get()).toBe(5);

    storeA.set(10);
    expect(storeB.get()).toBe(10);

    entangled.untangle();

    storeB.set(20);
    expect(storeA.get()).toBe(10);

    storeA.set(30);
    expect(storeB.get()).toBe(20);
  });

  test("untangle prevents listeners from being called", () => {
    const storeA = create(0);
    const listenerA = mock();
    const listenerB = mock();

    storeA.subscribe(listenerA);

    const entangled = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    const storeB = entangled;
    storeB.subscribe(listenerB);

    listenerA.mockClear();
    listenerB.mockClear();

    entangled.untangle();

    storeB.set(5);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledTimes(0);

    storeA.set(10);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledTimes(1);
  });

  test("untangle can be called multiple times safely", () => {
    const storeA = create(0);

    const entangled = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    const storeB = entangled;

    entangled.untangle();
    expect(() => entangled.untangle()).not.toThrow();

    storeB.set(5);
    expect(storeA.get()).toBe(0);
  });
});

describe("integration", () => {
  test("works with transactions", () => {
    const storeA = create(0);

    const storeB = entangle(create(0), {
      with: storeA,
      get: sourceState => sourceState,
      set: state => state
    });

    transaction(() => {
      storeB.set(5);
      expect(storeA.get()).toBe(5);
      storeA.set(10);
      expect(storeB.get()).toBe(10);
    });

    expect(storeB.get()).toBe(10);
    expect(storeA.get()).toBe(10);
  });
});

describe("derive", () => {
  test("creates a derived store", () => {
    const source = create(10);
    const derived = derive(source, {
      get: value => value * 2,
      set: value => value / 2
    });

    expect(derived.get()).toBe(20);

    derived.set(40);
    expect(source.get()).toBe(20);
    source.set(30);
    expect(derived.get()).toBe(60);
  });

  test("creates a read-only derived store", () => {
    const source = create(5);
    const derived = derive(source, {
      get: value => value * 3
    });

    expect(derived.get()).toBe(15);

    derived.set(6);
    expect(source.get()).toBe(5);
    expect(console.warn).toHaveBeenCalled();
    source.set(15);
    expect(derived.get()).toBe(45);
  });

  test("derived store has untangle method", () => {
    const source = create(1);
    const derived = derive(source, {
      get: value => value * 10,
      set: value => value / 10
    });

    expect(derived.untangle).toBeFunction();
    derived.set(20);
    expect(source.get()).toBe(2);
    source.set(3);
    expect(derived.get()).toBe(30);

    derived.untangle();

    derived.set(40);
    expect(source.get()).toBe(3);
    source.set(5);
    expect(derived.get()).toBe(40);
  });
});
