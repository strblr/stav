import { test, expect, mock, describe } from "bun:test";
import { nothing } from "immer";
import { create } from "../create";
import { immer } from "./immer";

describe("immer middleware", () => {
  test("adds produce method to store", () => {
    const store = immer(create({ count: 0 }));

    expect(store.produce).toBeFunction();
    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });
});

describe("produce with recipe function", () => {
  test("mutates draft state and updates store", () => {
    const store = immer(create({ count: 0, name: "test" }));

    store.produce(draft => {
      draft.count = 5;
    });
    expect(store.get()).toEqual({ count: 5, name: "test" });
  });

  test("multiple property mutations in single produce", () => {
    const store = immer(create({ count: 0, name: "test", active: false }));

    store.produce(draft => {
      draft.count = 10;
      draft.name = "updated";
      draft.active = true;
    });
    expect(store.get()).toEqual({ count: 10, name: "updated", active: true });
  });

  test("nested object mutations", () => {
    const store = immer(
      create({
        user: { name: "Alice", age: 30 },
        settings: { theme: "light", notifications: true }
      })
    );

    store.produce(draft => {
      draft.user.age = 31;
      draft.settings.theme = "dark";
    });
    expect(store.get()).toEqual({
      user: { name: "Alice", age: 31 },
      settings: { theme: "dark", notifications: true }
    });
  });

  test("array mutations with push", () => {
    const store = immer(create({ items: [1, 2, 3] }));

    store.produce(draft => {
      draft.items.push(4);
    });
    expect(store.get()).toEqual({ items: [1, 2, 3, 4] });
  });

  test("array mutations with splice", () => {
    const store = immer(create({ items: [1, 2, 3, 4, 5] }));

    store.produce(draft => {
      draft.items.splice(1, 2);
    });
    expect(store.get()).toEqual({ items: [1, 4, 5] });
  });

  test("array item modification", () => {
    const store = immer(
      create({
        todos: [
          { id: 1, text: "Task 1", completed: false },
          { id: 2, text: "Task 2", completed: false }
        ]
      })
    );

    store.produce(draft => {
      draft.todos[1].completed = true;
    });
    expect(store.get().todos[1].completed).toBe(true);
    expect(store.get().todos[0].completed).toBe(false);
  });

  test("adding new property to object", () => {
    const store = immer(create<{ count: number; name?: string }>({ count: 0 }));

    store.produce(draft => {
      draft.name = "test";
    });
    expect(store.get()).toEqual({ count: 0, name: "test" });
  });

  test("deleting property from object", () => {
    const store = immer(
      create<{ count: number; extra?: string }>({ count: 0, extra: "value" })
    );

    store.produce((draft: any) => {
      delete draft.extra;
    });
    expect(store.get()).toEqual({ count: 0 });
  });

  test("recipe can return new state", () => {
    const store = immer(create({ count: 0 }));

    store.produce(() => {
      return { count: 42 };
    });
    expect(store.get()).toEqual({ count: 42 });
  });

  test("returning nothing deletes for undefined states", () => {
    const store = immer(
      create<{ value: string } | undefined>({ value: "test" })
    );

    store.produce(() => nothing);
    expect(store.get()).toBe(undefined);
  });
});

describe("produce with direct state", () => {
  test("passes object directly to set", () => {
    const store = immer(create({ count: 0, name: "test" }));
    store.produce({ count: 10, name: "updated" });
    expect(store.get()).toEqual({ count: 10, name: "updated" });
  });

  test("passes primitive directly to set", () => {
    const store = immer(create(0));
    store.produce(42);
    expect(store.get()).toBe(42);
  });

  test("passes array directly to set", () => {
    const store = immer(create([1, 2, 3]));
    store.produce([4, 5, 6]);
    expect(store.get()).toEqual([4, 5, 6]);
  });

  test("passes null directly to set", () => {
    const store = immer(create<{ value: string } | null>({ value: "test" }));
    store.produce(null);
    expect(store.get()).toBe(null);
  });
});

describe("subscribers notification", () => {
  test("subscribers are notified on produce mutations", () => {
    const store = immer(create({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.produce(draft => {
      draft.count = 5;
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
  });

  test("subscribers are notified on produce with direct state", () => {
    const store = immer(create({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.produce({ count: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 10 }, { count: 0 });
  });

  test("subscribers receive immutable updates", () => {
    const store = immer(
      create({
        items: [1, 2, 3]
      })
    );
    const listener = mock();
    store.subscribe(listener);

    const originalItems = store.get().items;

    store.produce(draft => {
      draft.items.push(4);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get().items).not.toBe(originalItems);
    expect(originalItems).toEqual([1, 2, 3]);
    expect(store.get().items).toEqual([1, 2, 3, 4]);
  });
});

describe("edge cases", () => {
  test("works with primitive state", () => {
    const store = immer(create(0));
    store.produce(() => 42);
    expect(store.get()).toBe(42);
  });

  test("works with null state", () => {
    const store = immer(create<{ value: string } | null>(null));
    store.produce(() => ({ value: "test" }));
    expect(store.get()).toEqual({ value: "test" });
  });

  test("works with store that has custom handlers", () => {
    const store = immer(
      create(
        { count: 0 },
        {
          increment: () =>
            store.produce(s => {
              s.count++;
            }),
          decrement: () =>
            store.produce(s => {
              s.count--;
            })
        }
      )
    );

    store.increment();
    expect(store.get()).toEqual({ count: 1 });
    store.decrement();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("multiple immer stores are independent", () => {
    const store1 = immer(create({ count: 0 }));
    const store2 = immer(create({ value: "a" }));

    store1.produce(draft => {
      draft.count = 5;
    });
    store2.produce(draft => {
      draft.value = "b";
    });

    expect(store1.get()).toEqual({ count: 5 });
    expect(store2.get()).toEqual({ value: "b" });
  });

  test("produce with no mutations doesn't trigger subscribers", () => {
    const store = immer(create({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.produce(() => {});
    expect(listener).not.toHaveBeenCalled();
  });

  test("produce with mutations that result in same doesn't trigger subscribers", () => {
    const store = immer(create({ count: 5 }));
    const listener = mock();
    store.subscribe(listener);

    store.produce(d => {
      d.count = 5;
    });
    expect(listener).not.toHaveBeenCalled();
  });

  test("original set method still works", () => {
    const store = immer(create({ count: 0 }));

    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });

    store.set(s => ({ count: s.count + 1 }));
    expect(store.get()).toEqual({ count: 6 });
  });

  test("structural sharing is preserved for unchanged nested objects", () => {
    const store = immer(
      create({
        user: { name: "Alice", age: 30 },
        settings: { theme: "light", notifications: true }
      })
    );

    const originalSettings = store.get().settings;
    const originalUser = store.get().user;

    store.produce(draft => {
      draft.user.age = 31;
    });

    expect(store.get().settings).toBe(originalSettings);
    expect(store.get().user).not.toBe(originalUser);
  });

  test("rapid consecutive produce calls", () => {
    const store = immer(create({ count: 0 }));

    for (let i = 1; i <= 10; i++) {
      store.produce(draft => {
        draft.count = i;
      });
    }
    expect(store.get()).toEqual({ count: 10 });
  });

  test("produce inside subscriber", () => {
    const store = immer(create({ count: 0, doubled: 0 }));

    store.subscribe(state => {
      if (state.doubled !== state.count * 2) {
        store.produce(draft => {
          draft.doubled = draft.count * 2;
        });
      }
    });

    store.produce(draft => {
      draft.count = 5;
    });
    expect(store.get()).toEqual({ count: 5, doubled: 10 });
  });
});
