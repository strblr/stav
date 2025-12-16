import { test, expect, mock, describe } from "bun:test";
import { create } from "./create";

describe("Basic functionality", () => {
  test("create returns all required methods", () => {
    const store = create(42);
    expect(store.get).toBeFunction();
    expect(store.getInitial).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("get returns current state", () => {
    const store = create("hello");
    expect(store.get()).toBe("hello");
  });

  test("getInitial returns initial state", () => {
    const initialState = { count: 0 };
    const store = create(initialState);
    expect(store.getInitial()).toBe(initialState);
  });

  test("set with value updates state", () => {
    const store = create(1);
    store.set(42);
    expect(store.get()).toBe(42);
  });

  test("set preserves initial state", () => {
    const store = create("initial");
    store.set("changed");
    expect(store.getInitial()).toBe("initial");
    expect(store.get()).toBe("changed");
  });
});

describe("Function updater", () => {
  test("set with function updater receives current state", () => {
    const store = create(10);
    store.set(current => current * 2);
    expect(store.get()).toBe(20);
  });

  test("get can be called inside the updater", () => {
    const store = create({ count: 5 });
    store.set(() => ({ count: store.get().count + 1 }));
    expect(store.get()).toEqual({ count: 6 });
  });
});

describe("Subscription system", () => {
  test("subscribe returns unsubscribe function", () => {
    const store = create(0);
    const unsubscribe = store.subscribe(() => {});
    expect(unsubscribe).toBeFunction();
  });

  test("listeners are called when state changes", () => {
    const listener = mock();
    const store = create("initial");
    store.subscribe(listener);
    store.set("updated");
    expect(listener).toHaveBeenCalledWith("updated", "initial");
  });

  test("unsubscribe removes listener", () => {
    const listener = mock();
    const store = create(1);
    const unsubscribe = store.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(0);
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("multiple listeners are all called", () => {
    const listener1 = mock();
    const listener2 = mock();
    const store = create(0);
    store.subscribe(listener1);
    store.subscribe(listener2);
    store.set(1);
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

describe("Object.is optimization", () => {
  test("set with same value doesn't notify listeners (primitives)", () => {
    const listener = mock();
    const store = create(42);
    store.subscribe(listener);
    store.set(42);
    expect(listener).not.toHaveBeenCalled();
  });

  test("set with same value doesn't notify listeners (objects)", () => {
    const obj = { value: 1 };
    const listener = mock();
    const store = create(obj);
    store.subscribe(listener);
    store.set(obj);
    expect(listener).not.toHaveBeenCalled();
  });

  test("set with equal but different objects notifies listeners", () => {
    const listener = mock();
    const store = create({ value: 1 });
    store.subscribe(listener);
    store.set({ value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("set with NaN vs NaN doesn't notify (Object.is behavior)", () => {
    const listener = mock();
    const store = create(NaN);
    store.subscribe(listener);
    store.set(NaN);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Different data types", () => {
  test("works with primitive types", () => {
    const stringStore = create("hello");
    expect(stringStore.get()).toBe("hello");
    stringStore.set("world");
    expect(stringStore.get()).toBe("world");
    stringStore.set(s => s + "!");
    expect(stringStore.get()).toBe("world!");

    const numberStore = create(42);
    expect(numberStore.get()).toBe(42);
    numberStore.set(100);
    expect(numberStore.get()).toBe(100);
    numberStore.set(s => s + 1);
    expect(numberStore.get()).toBe(101);

    const boolStore = create(true);
    expect(boolStore.get()).toBe(true);
    boolStore.set(false);
    expect(boolStore.get()).toBe(false);
  });

  test("works with null and undefined", () => {
    const nullStore = create<any>(null);
    expect(nullStore.get()).toBeNull();
    nullStore.set("not null");
    expect(nullStore.get()).toBe("not null");

    const undefinedStore = create<any>(undefined);
    expect(undefinedStore.get()).toBeUndefined();
    undefinedStore.set("defined");
    expect(undefinedStore.get()).toBe("defined");
  });

  test("works with arrays", () => {
    const arrayStore = create([1, 2, 3]);
    expect(arrayStore.get()).toEqual([1, 2, 3]);
    arrayStore.set([4, 5, 6]);
    expect(arrayStore.get()).toEqual([4, 5, 6]);

    arrayStore.set(arr => [...arr, 7]);
    expect(arrayStore.get()).toEqual([4, 5, 6, 7]);
  });

  test("works with functions", () => {
    const initialFunction = () => "initial";
    const newFunction = () => "new";

    const functionStore = create(initialFunction);
    expect(functionStore.get()).toBe(initialFunction);

    functionStore.set(() => newFunction);
    expect(functionStore.get()).toBe(newFunction);

    functionStore.set(newFunction);
    expect(functionStore.get()).toBe("new" as any);
  });

  test("works with objects", () => {
    const complexStore = create({
      user: { name: "John", age: 30 },
      settings: { theme: "dark" }
    });

    expect(complexStore.get().user.name).toBe("John");

    complexStore.set(state => ({
      ...state,
      user: { ...state.user, age: 31 }
    }));

    expect(complexStore.get().user.age).toBe(31);
    expect(complexStore.get().settings.theme).toBe("dark");
  });
});

describe("Edge cases and advanced scenarios", () => {
  test("duplicate subscriptions work correctly", () => {
    const listener = mock();
    const store = create(0);
    const unsubscribe1 = store.subscribe(listener);
    const unsubscribe2 = store.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(0);
    store.set(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe1();
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe2();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("listeners receive correct previous state", () => {
    const states: number[] = [];
    const store = create(0);

    store.subscribe((state, prevState) => {
      states.push(state, prevState);
    });

    store.set(10);
    store.set(20);
    store.set(n => n + 10);
    store.set(store.getInitial);

    expect(states).toEqual([10, 0, 20, 10, 30, 20, 0, 30]);
  });

  test("changes should reflect immediately even with rapid updates", () => {
    const store = create(0);
    const updates: number[] = [];

    store.subscribe(state => updates.push(state));
    store.subscribe(() => updates.push(store.get()));

    store.set(s => s + 1);
    store.set(s => s + 1);
    store.set(s => s + 1);

    expect(store.get()).toBe(3);
    expect(updates).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe("Handlers functionality", () => {
  test("create with handlers returns store with handler methods", () => {
    const store = create(0, {
      increment: () => {},
      getValue: () => 42
    });

    expect(store.increment).toBeFunction();
    expect(store.getValue).toBeFunction();
    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("handlers can call base methods", () => {
    const store = create(0, {
      specialGet: () => store.get() + 1,
      specialSet: () => store.set(store.get() + 1)
    });

    expect(store.specialGet()).toBe(1);
    store.specialSet();
    expect(store.specialGet()).toBe(2);
  });

  test("handlers can call other handlers", () => {
    const store = create(3, {
      getBase: () => store.get(),
      getDoubled: () => store.getBase() * 2,
      getQuadrupled: () => store.getDoubled() * 2
    });

    expect(store.getBase()).toBe(3);
    expect(store.getDoubled()).toBe(6);
    expect(store.getQuadrupled()).toBe(12);
  });

  test("handlers work alongside base functionality", () => {
    const store = create(5, {
      customMethod: () => "custom"
    });

    expect(store.get()).toBe(5);
    expect(store.getInitial()).toBe(5);
    expect(store.customMethod()).toBe("custom");
    const listener = mock();
    store.subscribe(listener);
    store.set(25);
    expect(listener).toHaveBeenCalledWith(25, 5);
  });

  test("handlers can override base methods", () => {
    const store = create(42, {
      get: () => "overridden",
      set: () => "custom set called"
    });

    expect(store.get()).toBe("overridden");
    expect(store.set()).toBe("custom set called");
    expect(store.getInitial()).toBe(42);
  });

  test("empty handlers object works", () => {
    const store = create("test", {});

    expect(store.get()).toBe("test");
    expect(store.getInitial).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });
});
