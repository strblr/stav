import { test, expect, mock, describe } from "bun:test";
import { create } from "./create";
import { transaction, txIgnore } from "./transaction";

describe("transaction", () => {
  test("returns result of transaction function", () => {
    const result = transaction(() => "test");
    expect(result).toBe("test");
  });

  test("updates state in transaction", () => {
    const store = create({ count: 0 });

    transaction(() => {
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
      store.set({ count: 2 });
      expect(store.get()).toEqual({ count: 2 });
    });

    expect(store.get()).toEqual({ count: 2 });
  });

  test("reverts changes on error", () => {
    const store = create({ count: 0 });
    store.set({ count: 1 });

    try {
      transaction(() => {
        store.set({ count: 2 });
        store.set({ count: 3 });
        expect(store.get()).toEqual({ count: 3 });
        throw new Error("rollback");
      });
    } catch {}

    expect(store.get()).toEqual({ count: 1 });
  });

  test("reverts all stores in transaction on error", () => {
    const store1 = create({ count: 0 });
    const store2 = create({ value: "a" });

    try {
      transaction(() => {
        store1.set({ count: 5 });
        store2.set({ value: "b" });
        throw new Error("rollback");
      });
    } catch {}

    expect(store1.get()).toEqual({ count: 0 });
    expect(store2.get()).toEqual({ value: "a" });
  });

  test("rethrows error after rollback", () => {
    const store = create({ count: 0 });

    expect(() => {
      transaction(() => {
        store.set({ count: 1 });
        throw new Error("test error");
      });
    }).toThrow("test error");
  });
});

describe("nested transactions", () => {
  test("inner transaction creates new checkpoint", () => {
    const store = create({ count: 0 });

    transaction(() => {
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });

      try {
        transaction(() => {
          store.set({ count: 2 });
          store.set({ count: 3 });
          expect(store.get()).toEqual({ count: 3 });
          throw new Error("inner rollback");
        });
      } catch {}

      expect(store.get()).toEqual({ count: 1 });
    });

    expect(store.get()).toEqual({ count: 1 });
  });

  test("outer transaction rollback includes all nested changes", () => {
    const store = create({ count: 0 });

    try {
      transaction(() => {
        store.set({ count: 1 });
        transaction(() => {
          store.set({ count: 2 });
        });
        expect(store.get()).toEqual({ count: 2 });
        store.set({ count: 3 });
        expect(store.get()).toEqual({ count: 3 });
        throw new Error("outer rollback");
      });
    } catch {}

    expect(store.get()).toEqual({ count: 0 });
  });

  test("multiple nested transactions", () => {
    const store = create({ count: 0 });

    transaction(() => {
      store.set({ count: 1 });
      transaction(() => {
        store.set({ count: 2 });
        transaction(() => {
          store.set({ count: 3 });
        });
      });
    });

    expect(store.get()).toEqual({ count: 3 });
  });

  test("nested transaction rollback doesn't affect parent", () => {
    const store = create({ count: 0 });

    transaction(() => {
      store.set({ count: 1 });

      try {
        transaction(() => {
          store.set({ count: 2 });
          throw new Error("inner error");
        });
      } catch {}

      expect(store.get()).toEqual({ count: 1 });
      store.set({ count: 5 });
    });

    expect(store.get()).toEqual({ count: 5 });
  });

  test("deeply nested transactions with mixed rollback", () => {
    const store = create({ count: 0 });

    try {
      transaction(() => {
        store.set({ count: 1 });

        transaction(() => {
          store.set({ count: 2 });

          try {
            transaction(() => {
              store.set({ count: 3 });
              throw new Error("innermost error");
            });
          } catch {}

          expect(store.get()).toEqual({ count: 2 });
          store.set({ count: 4 });
        });

        expect(store.get()).toEqual({ count: 4 });
        throw new Error("test error");
      });
    } catch {}

    expect(store.get()).toEqual({ count: 0 });
  });
});

describe("async transactions", () => {
  test("returns promise for async transaction", async () => {
    const store = create({ count: 0 });

    const result = transaction(async () => {
      store.set({ count: 1 });
      return "async result";
    });

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe("async result");
  });

  test("updates state in async transaction", async () => {
    const store = create({ count: 0 });

    await transaction(async () => {
      store.set({ count: 1 });
      await Promise.resolve();
      store.set({ count: 2 });
    });

    expect(store.get()).toEqual({ count: 2 });
  });

  test("reverts async transaction on error", async () => {
    const store = create({ count: 0 });

    await transaction(async () => {
      store.set({ count: 1 });
      await Promise.resolve();
      store.set({ count: 2 });
      expect(store.get()).toEqual({ count: 2 });
      throw new Error("async error");
    }).catch(() => {});

    expect(store.get()).toEqual({ count: 0 });
  });

  test("rethrows error after async rollback", async () => {
    const store = create({ count: 0 });

    await expect(
      transaction(async () => {
        store.set({ count: 1 });
        throw new Error("async test error");
      })
    ).rejects.toThrow("async test error");
  });

  test("async transaction with multiple stores", async () => {
    const store1 = create({ count: 0 });
    const store2 = create({ value: "a" });

    await transaction(async () => {
      store1.set({ count: 5 });
      store2.set({ value: "b" });
      await Promise.resolve();
      throw new Error("rollback both");
    }).catch(() => {});

    expect(store1.get()).toEqual({ count: 0 });
    expect(store2.get()).toEqual({ value: "a" });
  });

  test("nested async transactions", async () => {
    const store = create({ count: 0 });

    await transaction(async () => {
      store.set({ count: 1 });

      await transaction(async () => {
        store.set({ count: 2 });
        await Promise.resolve();
        store.set({ count: 3 });
      });

      store.set({ count: 4 });
    });

    expect(store.get()).toEqual({ count: 4 });
  });

  test("inner async transaction rollback doesn't affect outer", async () => {
    const store = create({ count: 0 });

    await transaction(async () => {
      store.set({ count: 1 });

      await transaction(async () => {
        store.set({ count: 2 });
        await Promise.resolve();
        throw new Error("inner error");
      }).catch(() => {});

      expect(store.get()).toEqual({ count: 1 });
      store.set({ count: 5 });
    });

    expect(store.get()).toEqual({ count: 5 });
  });
});

describe("txIgnore", () => {
  test("marks store to ignore transactions", () => {
    const store = create({ count: 0 });
    const ignoredStore = txIgnore(store);
    expect(ignoredStore).toBe(store);
  });

  test("ignored store changes persist even on rollback", () => {
    const normalStore = create({ count: 0 });
    const ignoredStore = txIgnore(create({ value: 0 }));

    try {
      transaction(() => {
        normalStore.set({ count: 5 });
        ignoredStore.set({ value: 10 });
        throw new Error("rollback");
      });
    } catch {}

    expect(normalStore.get()).toEqual({ count: 0 });
    expect(ignoredStore.get()).toEqual({ value: 10 });
  });

  test("ignored store works with nested transactions", () => {
    const normalStore = create({ count: 0 });
    const ignoredStore = txIgnore(create({ value: 0 }));

    transaction(() => {
      normalStore.set({ count: 1 });
      ignoredStore.set({ value: 1 });

      try {
        transaction(() => {
          normalStore.set({ count: 2 });
          ignoredStore.set({ value: 2 });
          throw new Error("inner rollback");
        });
      } catch {}

      expect(normalStore.get()).toEqual({ count: 1 });
      expect(ignoredStore.get()).toEqual({ value: 2 });
    });

    expect(normalStore.get()).toEqual({ count: 1 });
    expect(ignoredStore.get()).toEqual({ value: 2 });
  });
});

describe("edge cases", () => {
  test("transaction with no store mutations", () => {
    const store = create({ count: 0 });

    transaction(() => {
      const value = store.get();
      expect(value).toEqual({ count: 0 });
    });

    expect(store.get()).toEqual({ count: 0 });
  });

  test("subscribers are notified inside transaction", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    transaction(() => {
      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(2);
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("subscribers are notified on rollback", () => {
    const store = create({ count: 0 });
    const listener = mock();
    store.subscribe(listener);

    try {
      transaction(() => {
        store.set({ count: 1 });
        store.set({ count: 2 });
        throw new Error("rollback");
      });
    } catch {}

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith({ count: 0 }, { count: 2 });
  });

  test("transaction with store that has handlers", () => {
    const store = create(
      { count: 0 },
      { increment: () => store.set(s => ({ count: s.count + 1 })) }
    );

    try {
      transaction(() => {
        store.increment();
        store.increment();
        throw new Error("rollback");
      });
    } catch {}

    expect(store.get()).toEqual({ count: 0 });
  });

  test("very deep nested transactions", () => {
    const store = create({ count: 0 });

    const createNestedTransaction = (depth: number): void => {
      if (depth === 0) {
        store.set({ count: store.get().count + 1 });
        return;
      }
      transaction(() => {
        createNestedTransaction(depth - 1);
      });
    };

    createNestedTransaction(20);
    expect(store.get()).toEqual({ count: 1 });
  });
});
