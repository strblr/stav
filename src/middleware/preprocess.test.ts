import { test, expect, mock, describe } from "bun:test";
import { z } from "zod";
import { create } from "../create";
import { preprocess } from "./preprocess";
import { immer } from "./immer";
import { object } from "./object";

describe("preprocess middleware", () => {
  test("returns store with all methods", () => {
    const store = preprocess(create({ count: 0 }));

    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });

  test("works without options", () => {
    const store = preprocess(create({ count: 0 }));
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("works with empty options", () => {
    const store = preprocess(create({ count: 0 }), {});
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("works with store custom handlers", () => {
    const store = preprocess(
      create(
        { count: 0 },
        {
          increment: () => store.set(s => ({ count: s.count + 1 })),
          decrement: () => store.set(s => ({ count: s.count - 1 }))
        }
      ),
      { validate: state => state.count >= 0 }
    );

    store.increment();
    expect(store.get()).toEqual({ count: 1 });

    store.decrement();
    expect(store.get()).toEqual({ count: 0 });

    store.decrement();
    expect(store.get()).toEqual({ count: 0 });
  });
});

describe("transform", () => {
  test("transforms state before setting", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => ({ count: state.count * 2 })
    });
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 10 });
  });

  test("transforms state with updater function", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => ({ count: state.count * 2 })
    });
    store.set(s => ({ count: s.count + 1 }));
    expect(store.get()).toEqual({ count: 2 });
  });

  test("applies multiple transformations", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => ({ count: state.count + 10 })
    });

    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 15 });

    store.set({ count: 3 });
    expect(store.get()).toEqual({ count: 13 });
  });

  test("transforms nested objects", () => {
    const store = preprocess(create({ user: { name: "", age: 0 } }), {
      transform: state => ({
        user: { ...state.user, name: state.user.name.toUpperCase() }
      })
    });
    store.set({ user: { name: "alice", age: 30 } });
    expect(store.get()).toEqual({ user: { name: "ALICE", age: 30 } });
  });

  test("normalizes state", () => {
    const store = preprocess(create({ value: 0 }), {
      transform: state => ({
        value: Math.max(0, Math.min(100, state.value))
      })
    });

    store.set({ value: 150 });
    expect(store.get()).toEqual({ value: 100 });

    store.set({ value: -10 });
    expect(store.get()).toEqual({ value: 0 });

    store.set({ value: 50 });
    expect(store.get()).toEqual({ value: 50 });
  });
});

describe("validate function", () => {
  test("allows valid state", () => {
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0
    });
    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("rejects invalid state", () => {
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0
    });
    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: 0 });
  });

  test("returns error message as string", () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: state => (state.count >= 0 ? true : "Count must be positive"),
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: 0 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith([
      { message: "Count must be positive" }
    ]);
  });

  test("calls onValidationError with default message on false", () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0,
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith([{ message: "Validation failed" }]);
  });

  test("does not call onValidationError on valid state", () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0,
      onValidationError: onError
    });

    store.set({ count: 5 });
    expect(onError).not.toHaveBeenCalled();
  });

  test("validates with updater function", () => {
    const store = preprocess(create({ count: 5 }), {
      validate: state => state.count >= 0
    });

    store.set(s => ({ count: s.count - 10 }));
    expect(store.get()).toEqual({ count: 5 });

    store.set(s => ({ count: s.count + 10 }));
    expect(store.get()).toEqual({ count: 15 });
  });
});

describe("validate with standard schema", () => {
  test("allows valid state with zod schema", () => {
    const schema = z.object({ count: z.number().min(0) });
    const store = preprocess(create({ count: 0 }), {
      validate: schema
    });

    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 5 });
  });

  test("rejects invalid state with zod schema", () => {
    const schema = z.object({ count: z.number().min(0) });
    const store = preprocess(create({ count: 0 }), {
      validate: schema
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: 0 });
  });

  test("calls onValidationError with zod issues", () => {
    const onError = mock();
    const schema = z.object({ count: z.number().min(0) });
    const store = preprocess(create({ count: 0 }), {
      validate: schema,
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeArrayOfSize(1);
    expect(onError.mock.calls[0][0][0]).toHaveProperty("message");
  });

  test("handles zod refinements", () => {
    const schema = z
      .object({
        password: z.string(),
        confirmPassword: z.string()
      })
      .refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match"
      });

    const onError = mock();
    const store = preprocess(create({ password: "", confirmPassword: "" }), {
      validate: schema,
      onValidationError: onError
    });

    store.set({ password: "abc123", confirmPassword: "def456" });
    expect(store.get()).toEqual({ password: "", confirmPassword: "" });
    expect(onError).toHaveBeenCalledTimes(1);

    store.set({ password: "abc123", confirmPassword: "abc123" });
    expect(store.get()).toEqual({
      password: "abc123",
      confirmPassword: "abc123"
    });
  });

  test("does not call onValidationError when zod validation passes", () => {
    const onError = mock();
    const schema = z.object({ count: z.number().min(0) });
    const store = preprocess(create({ count: 0 }), {
      validate: schema,
      onValidationError: onError
    });

    store.set({ count: 5 });
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("blockOnValidationError option", () => {
  test("allows invalid state when false", () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0,
      blockOnValidationError: false,
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: -5 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("allows invalid state with zod schema when false", () => {
    const onError = mock();
    const schema = z.object({ count: z.number().min(0) });
    const store = preprocess(create({ count: 0 }), {
      validate: schema,
      blockOnValidationError: false,
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: -5 });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("async validation", () => {
  test("handles async validation with promise", async () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: async state => state.count >= 0,
      onValidationError: onError
    });

    store.set({ count: -5 });
    await sleep();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("async validation does not block state update", async () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: async state => {
        await sleep(5);
        return state.count >= 0;
      },
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: -5 });
    await sleep(10);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("async validation with error message", async () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: async state => (state.count >= 0 ? true : "Invalid count"),
      onValidationError: onError
    });

    store.set({ count: -5 });
    await sleep();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith([{ message: "Invalid count" }]);
  });

  test("blockOnValidationError true has no effect on async function validation", async () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: async state => {
        await sleep(5);
        return state.count >= 0;
      },
      blockOnValidationError: true,
      onValidationError: onError
    });

    store.set({ count: -5 });
    expect(store.get()).toEqual({ count: -5 });
    await sleep(10);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("transform and validate combined", () => {
  test("validates after transform", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => ({ count: state.count * 2 }),
      validate: state => state.count >= 0 && state.count <= 100
    });

    store.set({ count: 40 });
    expect(store.get()).toEqual({ count: 80 });

    store.set({ count: 60 });
    expect(store.get()).toEqual({ count: 80 });
  });

  test("transform can fix invalid input", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => ({ count: Math.max(0, state.count) }),
      validate: state => state.count >= 0
    });

    store.set({ count: -50 });
    expect(store.get()).toEqual({ count: 0 });
  });

  test("transform and zod validation together", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(20)
    });

    const store = preprocess(create({ name: "", age: 0 }), {
      transform: state => ({
        name: state.name.trim(),
        age: Math.floor(state.age)
      }),
      validate: schema
    });

    store.set({ name: "  Bob  ", age: 25.7 });
    expect(store.get()).toEqual({ name: "Bob", age: 25 });

    store.set({ name: "   ", age: 25 });
    expect(store.get()).toEqual({ name: "Bob", age: 25 });
  });
});

describe("edge cases", () => {
  test("handles primitive state", () => {
    const store = preprocess(create(0), {
      validate: state => state >= 0
    });

    store.set(-5);
    expect(store.get()).toBe(0);

    store.set(5);
    expect(store.get()).toBe(5);
  });

  test("handles null state", () => {
    const store = preprocess(create<{ value: string } | null>(null), {
      validate: state => state === null || state.value.length > 0
    });

    store.set({ value: "" });
    expect(store.get()).toBe(null);

    store.set({ value: "test" });
    expect(store.get()).toEqual({ value: "test" });
  });

  test("handles array state", () => {
    const store = preprocess(create<number[]>([]), {
      transform: state => state.filter(n => n >= 0),
      validate: state => state.length <= 5
    });

    store.set([1, -2, 3, -4, 5]);
    expect(store.get()).toEqual([1, 3, 5]);

    store.set([1, 2, 3, 4, 5, 6, 7]);
    expect(store.get()).toEqual([1, 3, 5]);
  });

  test("transform that returns same state preserves reference", () => {
    const store = preprocess(create({ count: 0 }), {
      transform: state => state
    });
    const listener = mock();
    store.subscribe(listener);
    store.set(store.get());
    expect(listener).not.toHaveBeenCalled();
  });

  test("validation that always returns true", () => {
    const store = preprocess(create({ count: 0 }), {
      validate: () => true
    });

    store.set({ count: -999 });
    expect(store.get()).toEqual({ count: -999 });
  });

  test("validation that always returns false", () => {
    const onError = mock();
    const store = preprocess(create({ count: 0 }), {
      validate: () => false,
      onValidationError: onError
    });

    store.set({ count: 5 });
    expect(store.get()).toEqual({ count: 0 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("rapid consecutive updates with validation", () => {
    const store = preprocess(create({ count: 0 }), {
      validate: state => state.count >= 0 && state.count <= 100
    });
    for (let i = 1; i <= 100; i++) {
      store.set({ count: i * 10 });
    }
    expect(store.get()).toEqual({ count: 100 });
  });
});

describe("middleware integration", () => {
  test("works with immer middleware", () => {
    const store = preprocess(immer(create({ count: 0, name: "test" })), {
      validate: state => state.count >= 0
    });

    store.produce(draft => {
      draft.count = 5;
      draft.name = "updated";
    });
    expect(store.get()).toEqual({ count: 5, name: "updated" });

    store.produce(draft => {
      draft.count = -10;
    });
    expect(store.get()).toEqual({ count: 5, name: "updated" });
  });

  test("works with immer middleware and transform", () => {
    const store = preprocess(immer(create({ value: 0 })), {
      transform: state => ({ value: Math.abs(state.value) }),
      validate: state => state.value <= 100
    });

    store.produce(draft => {
      draft.value = -50;
    });
    expect(store.get()).toEqual({ value: 50 });

    store.produce(draft => {
      draft.value = -150;
    });
    expect(store.get()).toEqual({ value: 50 });
  });

  test("works with immer middleware and blockOnValidationError false", () => {
    const onError = mock();
    const store = preprocess(immer(create({ count: 0 })), {
      validate: state => state.count >= 0,
      blockOnValidationError: false,
      onValidationError: onError
    });

    store.produce(draft => {
      draft.count = -5;
    });
    expect(store.get()).toEqual({ count: -5 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("works with object middleware", () => {
    const store = preprocess(
      object(create({ count: 0, name: "test", active: false })),
      { validate: state => state.count >= 0 }
    );

    store.assign({ count: 5 });
    expect(store.get()).toEqual({ count: 5, name: "test", active: false });

    store.assign({ count: -10 }, { name: "updated" });
    expect(store.get()).toEqual({ count: 5, name: "test", active: false });

    store.assign({ count: 10 }, { name: "updated" });
    expect(store.get()).toEqual({ count: 10, name: "updated", active: false });
  });

  test("works with object middleware and transform", () => {
    const store = preprocess(object(create({ name: "", email: "" })), {
      transform: state => ({
        name: state.name.trim(),
        email: state.email.toLowerCase().trim()
      }),
      validate: state => state.name.length > 0 && state.email.includes("@")
    });

    store.assign({ name: "  Alice  ", email: "  ALICE@EXAMPLE.COM  " });
    expect(store.get()).toEqual({ name: "Alice", email: "alice@example.com" });

    store.assign({ email: "invalid" });
    expect(store.get()).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  test("works with object middleware and blockOnValidationError false", () => {
    const onError = mock();
    const store = preprocess(object(create({ count: 0, value: 0 })), {
      validate: state => state.count >= 0,
      blockOnValidationError: false,
      onValidationError: onError
    });

    store.assign({ count: -5 });
    expect(store.get()).toEqual({ count: -5, value: 0 });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("works with object middleware updater functions", () => {
    const store = preprocess(object(create({ count: 0, multiplier: 2 })), {
      validate: state => state.count >= 0
    });

    store.assign(s => ({ count: s.count + 5 }));
    expect(store.get()).toEqual({ count: 5, multiplier: 2 });

    store.assign(s => ({ count: s.count - 10 }));
    expect(store.get()).toEqual({ count: 5, multiplier: 2 });
  });
});

// Utils

function sleep(ms = 1) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
