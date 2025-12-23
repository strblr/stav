import { test, expect, mock, describe } from "bun:test";
import { create } from "./create";
import { transaction, createTransaction } from "./transaction";

describe("transaction", () => {
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

  test("transaction return value passes through", () => {
    const result = transaction(() => {
      return { success: true, value: 42 };
    });

    expect(result).toEqual({ success: true, value: 42 });
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
});

describe("createTransaction", () => {
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
});

describe("async transaction", () => {
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

  test("async transaction return value passes through", async () => {
    const result = transaction(async () => {
      await Promise.resolve();
      return { success: true, value: 42 };
    });

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual({ success: true, value: 42 });
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
});

describe("nested transactions", () => {
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
