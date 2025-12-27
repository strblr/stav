import { test, expect, mock, describe } from "bun:test";
import { create } from "./create";
import { shallow } from "./utils";

describe("create", () => {
  test("returns a store object", () => {
    const store = create({ count: 0 });
    expect(store).toBeDefined();
    expect(store.get).toBeFunction();
    expect(store.getInitial).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("creates store with primitive state", () => {
    const store = create(42);
    expect(store.get()).toBe(42);
  });

  test("creates store with object state", () => {
    const initialState = { count: 0, name: "test" };
    const store = create(initialState);
    expect(store.get()).toEqual(initialState);
  });

  test("creates store with array state", () => {
    const initialState = [1, 2, 3];
    const store = create(initialState);
    expect(store.get()).toEqual(initialState);
  });

  test("creates store with null state", () => {
    const store = create(null);
    expect(store.get()).toBe(null);
  });

  test("creates store with undefined state", () => {
    const store = create(undefined);
    expect(store.get()).toBe(undefined);
  });
});

describe("get", () => {
  test("returns current state", () => {
    const store = create({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  test("returns updated state after set", () => {
    const store = create({ count: 0 });
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1 });
  });

  test("returns same reference if state unchanged", () => {
    const initialState = { count: 0 };
    const store = create(initialState);
    const state1 = store.get();
    const state2 = store.get();
    expect(state1).toBe(state2);
  });

  test("returns new reference after state change", () => {
    const store = create({ count: 0 });
    const state1 = store.get();
    store.set({ count: 1 });
    const state2 = store.get();
    expect(state1).not.toBe(state2);
  });
});

describe("getInitial", () => {
  test("returns initial state", () => {
    const initialState = { count: 0 };
    const store = create(initialState);
    expect(store.getInitial()).toBe(initialState);
  });

  test("returns initial state even after updates", () => {
    const initialState = { count: 0 };
    const store = create(initialState);
    store.set({ count: 5 });
    store.set({ count: 10 });
    expect(store.getInitial()).toBe(initialState);
  });

  test("returns initial primitive value", () => {
    const store = create(42);
    store.set(100);
    expect(store.getInitial()).toBe(42);
  });
});

describe("set", () => {
  describe("with direct value", () => {
    test("updates state with new value", () => {
      const store = create({ count: 0 });
      const result = store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
      expect(result).toBe(true);
    });

    test("returns false when setting same state", () => {
      const store = create({ count: 0 });
      const result = store.set(store.get());
      expect(result).toBe(false);
    });

    test("updates primitive state", () => {
      const store = create(0);
      const result = store.set(5);
      expect(store.get()).toBe(5);
      expect(result).toBe(true);
    });

    test("returns false when setting same primitive", () => {
      const store = create(42);
      const result = store.set(42);
      expect(result).toBe(false);
    });

    test("updates array state", () => {
      const store = create([1, 2, 3]);
      const result = store.set([4, 5, 6]);
      expect(store.get()).toEqual([4, 5, 6]);
      expect(result).toBe(true);
    });

    test("returns false when setting same array reference", () => {
      const initialArray = [1, 2, 3];
      const store = create(initialArray);
      const result = store.set(initialArray);
      expect(result).toBe(false);
    });

    test("can set state to null", () => {
      const store = create<{ count: number } | null>({ count: 0 });
      const result = store.set(null);
      expect(store.get()).toBe(null);
      expect(result).toBe(true);
    });

    test("can set state to undefined", () => {
      const store = create<{ count: number } | undefined>({ count: 0 });
      const result = store.set(undefined);
      expect(store.get()).toBe(undefined);
      expect(result).toBe(true);
    });
  });

  describe("with updater function", () => {
    test("updates state using updater function", () => {
      const store = create({ count: 0 });
      const result = store.set(state => ({ count: state.count + 1 }));
      expect(store.get()).toEqual({ count: 1 });
      expect(result).toBe(true);
    });

    test("returns false when updater returns same state", () => {
      const store = create({ count: 0 });
      const result = store.set(state => state);
      expect(result).toBe(false);
    });

    test("receives current state as argument", () => {
      const store = create({ count: 5 });
      const updater = mock((state: { count: number }) => ({
        count: state.count * 2
      }));
      const result = store.set(updater);
      expect(updater).toHaveBeenCalledWith({ count: 5 });
      expect(store.get()).toEqual({ count: 10 });
      expect(result).toBe(true);
    });

    test("applies multiple updates in sequence", () => {
      const store = create(0);
      const result1 = store.set(n => n + 1);
      const result2 = store.set(n => n + 2);
      const result3 = store.set(n => n + 3);
      expect(store.get()).toBe(6);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    test("can return same type or different type", () => {
      const store = create<number | string>(0);
      const result1 = store.set(n => (n as number) + 1);
      expect(store.get()).toBe(1);
      expect(result1).toBe(true);
      const result2 = store.set(() => "hello");
      expect(store.get()).toBe("hello");
      expect(result2).toBe(true);
    });
  });

  describe("equality checking", () => {
    test("does not trigger update when value is equal with default equality (Object.is)", () => {
      const store = create({ count: 0 });
      const listener = mock();
      store.subscribe(listener);

      const result = store.set(store.get());
      expect(listener).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test("does not trigger update for NaN with default equality", () => {
      const store = create(NaN);
      const listener = mock();
      store.subscribe(listener);

      const result = store.set(NaN);
      expect(listener).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test("triggers update when value is different", () => {
      const store = create({ count: 0 });
      const listener = mock();
      store.subscribe(listener);

      const result = store.set({ count: 0 });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    test("returns false with custom equality when states are considered equal", () => {
      const customEqual = (a: { count: number }, b: { count: number }) =>
        a.count === b.count;
      const store = create({ count: 0, other: "a" }, {}, customEqual);
      const result = store.set({ count: 0, other: "b" });
      expect(store.get()).toEqual({ count: 0, other: "a" });
      expect(result).toBe(false);
    });

    test("returns true with custom equality when states are different", () => {
      const customEqual = (a: { count: number }, b: { count: number }) =>
        a.count === b.count;
      const store = create({ count: 0, other: "a" }, {}, customEqual);
      const result = store.set({ count: 1, other: "a" });
      expect(store.get()).toEqual({ count: 1, other: "a" });
      expect(result).toBe(true);
    });

    test("returns true with custom equality when states are considered different", () => {
      const store = create(0, {}, () => false);
      const result = store.set(0);
      expect(store.get()).toBe(0);
      expect(result).toBe(true);
    });
  });
});

describe("subscribe", () => {
  test("calls listener when state changes", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("calls listener with new and previous state", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 5 });

    expect(listener).toHaveBeenCalledWith({ count: 5 }, { count: 0 });
  });

  test("calls multiple listeners", () => {
    const store = create({ count: 0 });
    const listener1 = mock();
    const listener2 = mock();
    const listener3 = mock();

    store.subscribe(listener1);
    store.subscribe(listener2);
    store.subscribe(listener3);

    store.set({ count: 1 });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);
  });

  test("does not call listener when state is equal", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const currentState = store.get();
    store.set(currentState);

    expect(listener).not.toHaveBeenCalled();
  });

  test("returns unsubscribe function", () => {
    const store = create({ count: 0 });
    const unsubscribe = store.subscribe(() => {});
    expect(unsubscribe).toBeFunction();
  });

  test("unsubscribe removes listener", () => {
    const store = create({ count: 0 });
    const listener = mock();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set({ count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  test("can unsubscribe one listener without affecting others", () => {
    const store = create({ count: 0 });
    const listener1 = mock();
    const listener2 = mock();

    const unsubscribe1 = store.subscribe(listener1);
    store.subscribe(listener2);

    unsubscribe1();
    store.set({ count: 1 });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  test("calling unsubscribe multiple times is safe", () => {
    const store = create({ count: 0 });
    const listener = mock();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    unsubscribe();
    unsubscribe();

    store.set({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  test("listeners receive updates in order", () => {
    const store = create({ count: 0 });
    const callOrder: number[] = [];

    store.subscribe(() => callOrder.push(1));
    store.subscribe(() => callOrder.push(2));
    store.subscribe(() => callOrder.push(3));

    store.set({ count: 1 });

    expect(callOrder).toEqual([1, 2, 3]);
  });
});

describe("custom equality function", () => {
  test("uses custom equality function", () => {
    const customEqual = mock((a: any, b: any) => a.count === b.count);
    const store = create({ count: 0, other: "a" }, {}, customEqual);
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 0, other: "b" });

    expect(customEqual).toHaveBeenCalledWith(
      { count: 0, other: "a" },
      { count: 0, other: "b" }
    );
    expect(listener).not.toHaveBeenCalled();
  });

  test("triggers update when custom equality returns false", () => {
    const customEqual = (a: { count: number }, b: { count: number }) =>
      a.count === b.count;
    const store = create({ count: 0, other: "a" }, {}, customEqual);
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 1, other: "b" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("does not trigger update when custom equality returns true", () => {
    const customEqual = () => true;
    const store = create({ count: 0 }, {}, customEqual);
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  test("shallow equality example", () => {
    const store = create({ count: 0, name: "test" }, {}, shallow);
    const listener = mock();
    store.subscribe(listener);

    store.set({ count: 0, name: "test" });
    expect(listener).not.toHaveBeenCalled();

    store.set({ count: 1, name: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("handlers", () => {
  test("merges handlers into store", () => {
    const handlers = {
      increment: () => {
        store.set(state => ({ count: state.count + 1 }));
      },
      decrement: () => {
        store.set(state => ({ count: state.count - 1 }));
      }
    };

    const store = create({ count: 0 }, handlers);

    expect(store.increment).toBeFunction();
    expect(store.decrement).toBeFunction();
  });

  test("handlers can access store methods", () => {
    const handlers = {
      increment: () => {
        store.set({ count: store.get().count + 1 });
      }
    };

    const store = create({ count: 0 }, handlers);

    store.increment();
    expect(store.get()).toEqual({ count: 1 });

    store.increment();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("handlers can call other handlers", () => {
    const handlers = {
      increment: () => {
        store.set(state => ({ count: state.count + 1 }));
      },
      incrementTwice: () => {
        store.increment();
        store.increment();
      }
    };

    const store = create({ count: 0 }, handlers);

    store.incrementTwice();
    expect(store.get()).toEqual({ count: 2 });
  });

  test("handlers can accept arguments", () => {
    const handlers = {
      add: (amount: number) => {
        store.set(state => state + amount);
      }
    };

    const store = create(0, handlers);

    store.add(5);
    expect(store.get()).toBe(5);

    store.add(3);
    expect(store.get()).toBe(8);
  });

  test("handlers with complex logic", () => {
    interface TodoState {
      todos: Array<{ id: number; text: string; completed: boolean }>;
      filter: "all" | "active" | "completed";
    }

    const handlers = {
      addTodo: (text: string) => {
        store.set(state => ({
          ...state,
          todos: [...state.todos, { id: Math.random(), text, completed: false }]
        }));
      },
      toggleTodo: (id: number) => {
        store.set(state => ({
          ...state,
          todos: state.todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          )
        }));
      },
      setFilter: (filter: TodoState["filter"]) => {
        store.set(state => ({ ...state, filter }));
      }
    };

    const store = create<TodoState, typeof handlers>(
      { todos: [], filter: "all" },
      handlers
    );

    store.addTodo("Learn Stav");
    expect(store.get().todos).toHaveLength(1);
    expect(store.get().todos[0].text).toBe("Learn Stav");

    const todoId = store.get().todos[0].id;
    store.toggleTodo(todoId);
    expect(store.get().todos[0].completed).toBe(true);

    store.setFilter("completed");
    expect(store.get().filter).toBe("completed");
  });

  test("empty handlers object", () => {
    const store = create({ count: 0 }, {});
    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });
});
