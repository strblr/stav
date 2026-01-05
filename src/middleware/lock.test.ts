import { test, expect, describe } from "bun:test";
import { create } from "../create";
import { lock } from "./lock";

describe("lock middleware", () => {
  test("adds lock store with methods", () => {
    const store = lock(create(0));

    expect(store.lock).toBeDefined();
    expect(store.lock.get).toBeFunction();
    expect(store.lock.get().locked).toBe(false);
  });

  test("lock() prevents store updates", () => {
    const store = lock(create(0));

    store.lock.lock();
    store.set(42);

    expect(store.get()).toBe(0);
  });

  test("unlock() allows store updates again", () => {
    const store = lock(create(0));

    store.lock.lock();
    store.set(42);
    expect(store.get()).toBe(0);

    store.lock.unlock();
    store.set(99);
    expect(store.get()).toBe(99);
  });

  test("toggle() switches lock state", () => {
    const store = lock(create(0));

    expect(store.lock.get().locked).toBe(false);
    store.lock.toggle();
    expect(store.lock.get().locked).toBe(true);
    store.lock.toggle();
    expect(store.lock.get().locked).toBe(false);
  });

  test("locked state prevents function updaters", () => {
    const store = lock(create(10));

    store.lock.lock();
    store.set(prev => prev + 5);

    expect(store.get()).toBe(10);
  });

  test("unlocked state allows normal updates", () => {
    const store = lock(create(10));

    store.set(20);
    expect(store.get()).toBe(20);

    store.set(prev => prev + 5);
    expect(store.get()).toBe(25);
  });

  test("subscribers are not notified when locked", () => {
    const store = lock(create(0));
    const calls: number[] = [];

    store.subscribe(state => calls.push(state));

    store.lock.lock();
    store.set(1);
    store.set(2);

    expect(calls).toEqual([]);

    store.lock.unlock();
    store.set(3);

    expect(calls).toEqual([3]);
  });
});
