import { test, expect, mock, describe, beforeAll } from "bun:test";
import { enableMapSet, nothing } from "immer";
import { create } from "../create";
import { immer } from "./immer";

beforeAll(() => {
  enableMapSet();
});

describe("Basic functionality", () => {
  test("immer returns enhanced store", () => {
    const store = immer(create({}));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.getInitial).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("immer preserves original store functionality", () => {
    const store = immer(create({ message: "hello" }));

    expect(store.get()).toEqual({ message: "hello" });
    expect(store.getInitial()).toEqual({ message: "hello" });
  });

  test("immer works with handlers", () => {
    const store = immer(
      create(
        { count: 0 },
        {
          increment: () =>
            store.set(state => {
              state.count += 1;
            })
        }
      )
    );

    expect(store.increment).toBeFunction();
  });
});

describe("Immer set functionality", () => {
  test("set with value updates state", () => {
    const store = immer(create({ value: 0 }));
    store.set({ value: 42 });
    expect(store.get()).toEqual({ value: 42 });
  });

  test("set with function updater mutates state using immer", () => {
    const store = immer(create({ count: 0 }));
    store.set(state => {
      state.count = 10;
    });
    expect(store.get()).toEqual({ count: 10 });
  });

  test("immer mutations don't affect original state reference", () => {
    const initialState = { items: [1, 2, 3] };
    const store = immer(create(initialState));

    store.set(state => {
      state.items.push(4);
    });

    expect(store.get()).toEqual({ items: [1, 2, 3, 4] });
    expect(initialState).toEqual({ items: [1, 2, 3] });
  });

  test("complex immer mutations work correctly", () => {
    const store = immer(
      create({
        user: { name: "John", age: 30 },
        settings: { theme: "dark" }
      })
    );

    store.set(state => {
      state.user.age++;
      state.settings.theme = "light";
      state.user.name = state.user.name.toUpperCase();
    });

    expect(store.get()).toEqual({
      user: { name: "JOHN", age: 31 },
      settings: { theme: "light" }
    });
  });

  test("immer set notifies listeners", () => {
    const listener = mock();
    const store = immer(create({ count: 0 }));
    store.subscribe(listener);

    store.set(state => {
      state.count = 5;
    });

    expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
  });

  test("immer set with value notifies listeners", () => {
    const listener = mock();
    const store = immer(create({}));
    store.subscribe(listener);

    store.set({ value: 20 });

    expect(listener).toHaveBeenCalledWith({ value: 20 }, {});
  });
});

describe("Different data types", () => {
  test("works with primitive values in objects", () => {
    const numberStore = immer(create({ value: 0 }));
    numberStore.set(state => {
      state.value = 100;
    });
    expect(numberStore.get()).toEqual({ value: 100 });

    const stringStore = immer(create({ text: "" }));
    stringStore.set(state => {
      state.text = "world";
    });
    expect(stringStore.get()).toEqual({ text: "world" });

    const boolStore = immer(create({ enabled: true }));
    boolStore.set(state => {
      state.enabled = false;
    });
    expect(boolStore.get()).toEqual({ enabled: false });
  });

  test("works with null and undefined values in objects", () => {
    const nullStore = immer(create<{ value: string | null }>({ value: null }));
    nullStore.set(state => {
      state.value = "not null";
    });
    expect(nullStore.get()).toEqual({ value: "not null" });

    const undefinedStore = immer(create<{ value?: string }>({}));
    undefinedStore.set(state => {
      state.value = "defined";
    });
    expect(undefinedStore.get()).toEqual({ value: "defined" });
  });

  test("works with arrays", () => {
    const arrayStore = immer(create([1, 2, 3]));
    arrayStore.set(state => {
      state.length = 0;
      state.push(4, 5, 6);
    });
    expect(arrayStore.get()).toEqual([4, 5, 6]);

    arrayStore.set(state => {
      state.push(7);
    });
    expect(arrayStore.get()).toEqual([4, 5, 6, 7]);
  });

  test("works with objects", () => {
    const objectStore = immer(
      create({
        user: { name: "John", age: 30 },
        settings: { theme: "dark" }
      })
    );

    objectStore.set(state => {
      state.user.age = 31;
      state.settings.theme = "light";
    });

    expect(objectStore.get()).toEqual({
      user: { name: "John", age: 31 },
      settings: { theme: "light" }
    });
  });

  test("works with nested mutations", () => {
    const store = immer(
      create({
        users: [
          { id: 1, name: "John", posts: [{ title: "Hello" }] },
          { id: 2, name: "Jane", posts: [{ title: "Hi" }] }
        ]
      })
    );

    store.set(state => {
      const john = state.users.find(u => u.id === 1)!;
      john.name = "Johnny";
      john.posts.push({ title: "New Post" });

      state.users.push({
        id: 3,
        name: "Bob",
        posts: [{ title: "Welcome" }]
      });
    });

    expect(store.get().users).toEqual([
      {
        id: 1,
        name: "Johnny",
        posts: [{ title: "Hello" }, { title: "New Post" }]
      },
      { id: 2, name: "Jane", posts: [{ title: "Hi" }] },
      { id: 3, name: "Bob", posts: [{ title: "Welcome" }] }
    ]);
  });
});

describe("Integration with store features", () => {
  test("immer set preserves Object.is optimization", () => {
    const listener = mock();
    const sameObject = { value: 42 };
    const store = immer(create(sameObject));
    store.subscribe(listener);

    store.set(sameObject);
    expect(listener).not.toHaveBeenCalled();
    store.set(() => {});
    expect(listener).not.toHaveBeenCalled();
    store.set({ value: 43 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("Edge cases", () => {
  test("immer handles empty mutations", () => {
    const store = immer(create({ count: 5 }));
    const listener = mock();
    store.subscribe(listener);
    store.set(_state => {});

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 5 });
  });

  test("immer set with function that returns value works", () => {
    const store = immer(create({ test: 10 }));
    store.set(() => ({ test: 20 }));
    expect(store.get()).toEqual({ test: 20 });
  });

  test("immer set with function that returns nothing sets state to undefined", () => {
    const store = immer(
      create<{ count: number; items: number[] } | undefined>({
        count: 0,
        items: [1, 2]
      })
    );
    const listener = mock();
    store.subscribe(listener);
    expect(store.get()).not.toBeUndefined();
    store.set(() => nothing);
    expect(store.get()).toBeUndefined();
    expect(listener).toHaveBeenCalledWith(undefined, {
      count: 0,
      items: [1, 2]
    });
  });

  test("immer works with Map state types", () => {
    const initial = new Map<string, number>().set("a", 1);
    const store = immer(create(initial));
    store.set(state => {
      state.set("b", 2);
      state.set("a", 3);
    });

    expect(store.get()).not.toBe(initial);
    expect(Array.from(store.get().entries())).toEqual([
      ["a", 3],
      ["b", 2]
    ]);
  });

  test("immer works with Set state types", () => {
    const initial = new Set<number>([1, 2, 3]);
    const store = immer(create(initial));
    store.set(state => {
      state.add(4);
      state.delete(2);
    });

    expect(store.get()).not.toBe(initial);
    expect(Array.from(store.get())).toEqual([1, 3, 4]);
  });
});
