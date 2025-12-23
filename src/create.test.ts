import { test, expect, mock, describe } from "bun:test";
import { create } from "./create";
import { transaction, createTransaction } from "./transaction";
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
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
    });

    test("updates primitive state", () => {
      const store = create(0);
      store.set(5);
      expect(store.get()).toBe(5);
    });

    test("updates array state", () => {
      const store = create([1, 2, 3]);
      store.set([4, 5, 6]);
      expect(store.get()).toEqual([4, 5, 6]);
    });

    test("can set state to null", () => {
      const store = create<{ count: number } | null>({ count: 0 });
      store.set(null);
      expect(store.get()).toBe(null);
    });

    test("can set state to undefined", () => {
      const store = create<{ count: number } | undefined>({ count: 0 });
      store.set(undefined);
      expect(store.get()).toBe(undefined);
    });
  });

  describe("with updater function", () => {
    test("updates state using updater function", () => {
      const store = create({ count: 0 });
      store.set(state => ({ count: state.count + 1 }));
      expect(store.get()).toEqual({ count: 1 });
    });

    test("receives current state as argument", () => {
      const store = create({ count: 5 });
      const updater = mock((state: { count: number }) => ({
        count: state.count * 2
      }));
      store.set(updater);
      expect(updater).toHaveBeenCalledWith({ count: 5 });
      expect(store.get()).toEqual({ count: 10 });
    });

    test("applies multiple updates in sequence", () => {
      const store = create(0);
      store.set(n => n + 1);
      store.set(n => n + 2);
      store.set(n => n + 3);
      expect(store.get()).toBe(6);
    });

    test("can return same type or different type", () => {
      const store = create<number | string>(0);
      store.set(n => (n as number) + 1);
      expect(store.get()).toBe(1);
      store.set(() => "hello");
      expect(store.get()).toBe("hello");
    });
  });

  describe("equality checking", () => {
    test("does not trigger update when value is equal (Object.is)", () => {
      const store = create({ count: 0 });
      const listener = mock();
      store.subscribe(listener);

      const sameState = store.get();
      store.set(sameState);

      expect(listener).not.toHaveBeenCalled();
    });

    test("does not trigger update for NaN with default equality", () => {
      const store = create(NaN);
      const listener = mock();
      store.subscribe(listener);

      store.set(NaN);

      expect(listener).not.toHaveBeenCalled();
    });

    test("triggers update when value is different", () => {
      const store = create({ count: 0 });
      const listener = mock();
      store.subscribe(listener);

      store.set({ count: 0 });

      expect(listener).toHaveBeenCalledTimes(1);
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

describe("transactions", () => {
  test("transaction commits changes after sync function", () => {
    const store = create({ count: 0 });

    const result = transaction(() => {
      store.set({ count: 1 });
      store.set({ count: 2 });
      return "done";
    });

    expect(result).toBe("done");
    expect(store.get()).toEqual({ count: 2 });
  });

  test("transaction isolates changes until commit", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    transaction(() => {
      store.set({ count: 1 });
      store.set({ count: 2 });
      store.set({ count: 3 });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 3 }, { count: 0 });
  });

  test("transaction reads return forked state", () => {
    const store = create({ count: 0 });

    transaction(() => {
      expect(store.get()).toEqual({ count: 0 });

      store.set({ count: 5 });
      expect(store.get()).toEqual({ count: 5 });

      store.set({ count: 10 });
      expect(store.get()).toEqual({ count: 10 });
    });

    expect(store.get()).toEqual({ count: 10 });
  });

  test("transaction with multiple stores", () => {
    const store1 = create({ count: 0 });
    const store2 = create({ value: "a" });
    const listener1 = mock();
    const listener2 = mock();

    store1.subscribe(listener1);
    store2.subscribe(listener2);

    transaction(() => {
      store1.set({ count: 1 });
      store2.set({ value: "b" });
      store1.set({ count: 2 });
      store2.set({ value: "c" });
    });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(store1.get()).toEqual({ count: 2 });
    expect(store2.get()).toEqual({ value: "c" });
  });

  test("async transaction using act (setTimeout)", async () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    await transaction(act => {
      act(() => {
        store.set({ count: 1 });
        expect(store.get()).toEqual({ count: 1 });
      });

      return new Promise<void>(resolve => {
        setTimeout(() => {
          act(() => {
            store.set({ count: 2 });
            expect(store.get()).toEqual({ count: 2 });
          });

          setTimeout(() => {
            act(() => store.set({ count: 3 }));
            resolve();
          }, 0);
        }, 0);
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 3 }, { count: 0 });
    expect(store.get()).toEqual({ count: 3 });
  });

  test("async transaction using act (promise)", async () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    await transaction(async act => {
      act(() => store.set({ count: 1 }));
      await Promise.resolve();
      act(() => store.set({ count: 2 }));
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 2 }, { count: 0 });
    expect(store.get()).toEqual({ count: 2 });
  });

  test("createTransaction returns transaction object", () => {
    const tx = createTransaction();

    expect(tx).toBeDefined();
    expect(tx.act).toBeFunction();
    expect(tx.commit).toBeFunction();
  });

  test("manual transaction control with createTransaction", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const tx = createTransaction();

    tx.act(() => {
      store.set({ count: 1 });
      store.set({ count: 2 });
    });

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 0 });

    tx.commit();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ count: 2 });
  });

  test("transaction does not trigger listeners until commit", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);
    const tx = createTransaction();

    tx.act(() => {
      store.set({ count: 1 });
      expect(listener).not.toHaveBeenCalled();

      store.set({ count: 2 });
      expect(listener).not.toHaveBeenCalled();
    });

    expect(listener).not.toHaveBeenCalled();

    tx.commit();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("store outside transaction not affected", () => {
    const store1 = create({ count: 0 });
    const store2 = create({ count: 100 });
    const listener2 = mock();
    store2.subscribe(listener2);

    transaction(() => {
      store1.set({ count: 1 });
    });

    expect(listener2).not.toHaveBeenCalled();
    expect(store2.get()).toEqual({ count: 100 });
  });

  test("transaction return value passes through", () => {
    const result = transaction(() => {
      return { success: true, value: 42 };
    });

    expect(result).toEqual({ success: true, value: 42 });
  });

  test("async transaction return value passes through", async () => {
    const result = await transaction(async () => {
      await Promise.resolve();
      return { success: true, value: 42 };
    });

    expect(result).toEqual({ success: true, value: 42 });
  });

  test("transaction with updater function", () => {
    const store = create({ count: 0 });

    transaction(() => {
      store.set(state => ({ count: state.count + 1 }));
      store.set(state => ({ count: state.count + 2 }));
      store.set(state => ({ count: state.count + 3 }));
    });

    expect(store.get()).toEqual({ count: 6 });
  });

  test("transaction preserves store isolation", () => {
    const store1 = create({ count: 0 });
    const store2 = create({ count: 0 });

    transaction(() => {
      store1.set({ count: 1 });
      expect(store1.get()).toEqual({ count: 1 });
      expect(store2.get()).toEqual({ count: 0 });

      store2.set({ count: 2 });
      expect(store1.get()).toEqual({ count: 1 });
      expect(store2.get()).toEqual({ count: 2 });
    });
  });

  test("transaction discards changes on error", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const fn = () =>
      transaction(() => {
        store.set({ count: 1 });
        throw new Error("test");
      });

    expect(fn).toThrow("test");
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("async transaction discards changes on error", async () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const promise = transaction(async act => {
      await Promise.resolve();
      act(() => store.set({ count: 1 }));
      throw new Error("test");
    });

    await expect(promise).rejects.toThrow("test");
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("nested transactions commit independently", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    transaction(() => {
      store.set({ count: 1 });

      transaction(() => {
        expect(store.get()).toEqual({ count: 1 });
        store.set({ count: 2 });
      });

      expect(store.get()).toEqual({ count: 2 });
      store.set({ count: 3 });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 3 }, { count: 0 });
    expect(store.get()).toEqual({ count: 3 });
  });

  test("nested transaction discards changes on error", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const fn = () =>
      transaction(() => {
        store.set({ count: 1 });
        try {
          transaction(() => {
            store.set({ count: 2 });
            throw new Error("test");
          });
        } catch {}
      });

    expect(fn).not.toThrow();
    expect(listener).toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 1 });
  });

  test("nested transactions discard all changes on uncaught error", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const fn = () =>
      transaction(() => {
        store.set({ count: 1 });
        transaction(() => {
          store.set({ count: 2 });
          throw new Error("test");
        });
      });

    expect(fn).toThrow("test");
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("listener isolation between main scope and transaction", () => {
    const store = create({ count: 0 });
    const mainScopeListener = mock();
    const transactionListener = mock();

    store.subscribe(mainScopeListener);

    store.set({ count: 1 });
    expect(mainScopeListener).toHaveBeenCalledTimes(1);

    transaction(() => {
      store.subscribe(transactionListener);
      store.set({ count: 2 });
      store.set({ count: 3 });

      expect(transactionListener).toHaveBeenCalledTimes(2);
      expect(mainScopeListener).toHaveBeenCalledTimes(1);
    });

    expect(mainScopeListener).toHaveBeenCalledTimes(2);
    expect(transactionListener).toHaveBeenCalledTimes(2);
  });

  test("transactions can be committed multiple times", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    const tx = createTransaction();
    const tx2 = createTransaction(tx);

    tx.act(() => {
      store.set({ count: 1 });
    });

    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 0 });

    tx.commit();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ count: 1 });

    tx2.act(() => {
      store.set({ count: 2 });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ count: 1 });

    tx.commit();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ count: 1 });

    tx2.commit();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ count: 1 });

    tx.commit();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toEqual({ count: 2 });
  });
});
