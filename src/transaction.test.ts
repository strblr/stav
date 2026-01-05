import { describe, test, expect } from "bun:test";
import { create } from "./create.js";
import { transaction } from "./transaction.js";

describe("transaction synchronous", () => {
  test("keeps changes when function succeeds", () => {
    const store1 = create(0);
    const store2 = create("initial");

    const result = transaction(() => {
      store1.set(10);
      store2.set("updated");
      return "success";
    }, [store1, store2]);

    expect(result).toBe("success");
    expect(store1.get()).toBe(10);
    expect(store2.get()).toBe("updated");
  });

  test("reverts changes when function throws", () => {
    const store1 = create(0);
    const store2 = create("initial");

    expect(() => {
      transaction(() => {
        store1.set(10);
        store2.set("updated");
        throw new Error("rollback");
      }, [store1, store2]);
    }).toThrow("rollback");

    expect(store1.get()).toBe(0);
    expect(store2.get()).toBe("initial");
  });

  test("handles single store", () => {
    const store = create({ count: 0 });

    const result = transaction(() => {
      store.set({ count: 5 });
      return 42;
    }, [store]);

    expect(result).toBe(42);
    expect(store.get()).toEqual({ count: 5 });
  });

  test("handles empty store array", () => {
    const result = transaction(() => "done", []);
    expect(result).toBe("done");
  });
});

describe("transaction asynchronous", () => {
  test("commits changes when async function resolves", async () => {
    const store1 = create(0);
    const store2 = create("initial");

    const result = await transaction(async () => {
      store1.set(10);
      await Promise.resolve();
      store2.set("updated");
      return "async success";
    }, [store1, store2]);

    expect(result).toBe("async success");
    expect(store1.get()).toBe(10);
    expect(store2.get()).toBe("updated");
  });

  test("reverts changes when async function rejects", async () => {
    const store1 = create(0);
    const store2 = create("initial");

    await expect(
      transaction(async () => {
        store1.set(10);
        await Promise.resolve();
        store2.set("updated");
        throw new Error("async rollback");
      }, [store1, store2])
    ).rejects.toThrow("async rollback");

    expect(store1.get()).toBe(0);
    expect(store2.get()).toBe("initial");
  });

  test("handles delayed rejection", async () => {
    const store1 = create(5);
    const store2 = create(10);

    await expect(
      transaction(async () => {
        store1.set(50);
        await new Promise(resolve => setTimeout(resolve, 10));
        store2.set(100);
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error("delayed error");
      }, [store1, store2])
    ).rejects.toThrow("delayed error");

    expect(store1.get()).toBe(5);
    expect(store2.get()).toBe(10);
  });

  test("preserves async error", async () => {
    const store = create(0);
    const error = new Error("async custom error");

    try {
      await transaction(async () => {
        store.set(10);
        throw error;
      }, [store]);
    } catch (e) {
      expect(e).toBe(error);
    }
  });

  test("returns promise that resolves correctly", async () => {
    const store = create(0);

    const promise = transaction(async () => {
      store.set(5);
      await Promise.resolve();
      return { data: "result" };
    }, [store]);

    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(result).toEqual({ data: "result" });
    expect(store.get()).toBe(5);
  });
});

describe("transaction edge cases", () => {
  test("handles multiple updates to same store", () => {
    const store = create(0);

    transaction(() => {
      store.set(1);
      store.set(2);
      store.set(3);
    }, [store]);

    expect(store.get()).toBe(3);
  });

  test("reverts after multiple updates to same store", () => {
    const store = create(0);

    expect(() => {
      transaction(() => {
        store.set(1);
        store.set(2);
        store.set(3);
        throw new Error("fail");
      }, [store]);
    }).toThrow("fail");

    expect(store.get()).toBe(0);
  });
});
