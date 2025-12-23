import { test, expect, mock, describe } from "bun:test";
import { create } from "../create";
import { redux } from "./redux";

describe("redux middleware", () => {
  test("adds dispatch method to store", () => {
    type Action = { type: "increment" } | { type: "decrement" };
    const store = redux(
      create({ count: 0 }),
      (state, _action: Action) => state
    );

    expect(store.dispatch).toBeFunction();
    expect(store.get).toBeFunction();
    expect(store.set).toBeFunction();
    expect(store.subscribe).toBeFunction();
  });
});

describe("dispatch", () => {
  test("updates state through reducer", () => {
    type Action = { type: "increment" } | { type: "decrement" };
    const store = redux(create({ count: 0 }), (state, action: Action) => {
      switch (action.type) {
        case "increment":
          return { count: state.count + 1 };
        case "decrement":
          return { count: state.count - 1 };
        default:
          return state;
      }
    });

    store.dispatch({ type: "increment" });
    expect(store.get()).toEqual({ count: 1 });

    store.dispatch({ type: "increment" });
    expect(store.get()).toEqual({ count: 2 });

    store.dispatch({ type: "decrement" });
    expect(store.get()).toEqual({ count: 1 });
  });

  test("handles actions with payload", () => {
    type Action =
      | { type: "add"; value: number }
      | { type: "multiply"; value: number };
    const store = redux(create({ count: 10 }), (state, action: Action) => {
      switch (action.type) {
        case "add":
          return { count: state.count + action.value };
        case "multiply":
          return { count: state.count * action.value };
        default:
          return state;
      }
    });

    store.dispatch({ type: "add", value: 5 });
    expect(store.get()).toEqual({ count: 15 });

    store.dispatch({ type: "multiply", value: 2 });
    expect(store.get()).toEqual({ count: 30 });
  });

  test("notifies subscribers on dispatch", () => {
    type Action = { type: "increment" };
    const store = redux(create({ count: 0 }), (state, action: Action) => {
      if (action.type === "increment") {
        return { count: state.count + 1 };
      }
      return state;
    });
    const listener = mock();
    store.subscribe(listener);

    store.dispatch({ type: "increment" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
  });

  test("does not notify subscribers if state unchanged", () => {
    type Action = { type: "noop" } | { type: "increment" };
    const store = redux(create({ count: 0 }), (state, action: Action) => {
      if (action.type === "increment") {
        return { count: state.count + 1 };
      }
      return state;
    });
    const listener = mock();
    store.subscribe(listener);

    store.dispatch({ type: "noop" });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("complex state", () => {
  test("handles nested object state", () => {
    type Action =
      | { type: "updateUser"; name: string }
      | { type: "updateTheme"; theme: string };
    const store = redux(
      create({
        user: { name: "Alice", age: 30 },
        settings: { theme: "light" }
      }),
      (state, action: Action) => {
        switch (action.type) {
          case "updateUser":
            return { ...state, user: { ...state.user, name: action.name } };
          case "updateTheme":
            return { ...state, settings: { theme: action.theme } };
          default:
            return state;
        }
      }
    );

    store.dispatch({ type: "updateUser", name: "Bob" });
    expect(store.get()).toEqual({
      user: { name: "Bob", age: 30 },
      settings: { theme: "light" }
    });

    store.dispatch({ type: "updateTheme", theme: "dark" });
    expect(store.get()).toEqual({
      user: { name: "Bob", age: 30 },
      settings: { theme: "dark" }
    });
  });

  test("handles array state updates", () => {
    type Action =
      | { type: "add"; item: number }
      | { type: "remove"; index: number };
    const store = redux(
      create({ items: [1, 2, 3] }),
      (state, action: Action) => {
        switch (action.type) {
          case "add":
            return { items: [...state.items, action.item] };
          case "remove":
            const copy = [...state.items];
            copy.splice(action.index, 1);
            return { items: copy };
          default:
            return state;
        }
      }
    );

    store.dispatch({ type: "add", item: 4 });
    expect(store.get()).toEqual({ items: [1, 2, 3, 4] });

    store.dispatch({ type: "remove", index: 1 });
    expect(store.get()).toEqual({ items: [1, 3, 4] });
  });
});

describe("integration", () => {
  test("works alongside original set method", () => {
    type Action = { type: "increment" };
    const store = redux(create({ count: 0 }), (state, action: Action) => {
      if (action.type === "increment") {
        return { count: state.count + 1 };
      }
      return state;
    });

    store.dispatch({ type: "increment" });
    expect(store.get()).toEqual({ count: 1 });

    store.set({ count: 10 });
    expect(store.get()).toEqual({ count: 10 });

    store.dispatch({ type: "increment" });
    expect(store.get()).toEqual({ count: 11 });
  });

  test("works with store custom handlers", () => {
    type Action = { type: "increment" } | { type: "decrement" };
    const store = redux(
      create({ count: 0 }, { reset: () => store.set({ count: 0 }) }),
      (state, action: Action) => {
        switch (action.type) {
          case "increment":
            return { count: state.count + 1 };
          case "decrement":
            return { count: state.count - 1 };
          default:
            return state;
        }
      }
    );

    store.dispatch({ type: "increment" });
    store.dispatch({ type: "increment" });
    expect(store.get()).toEqual({ count: 2 });

    store.reset();
    expect(store.get()).toEqual({ count: 0 });
  });

  test("multiple redux stores are independent", () => {
    type Action1 = { type: "increment" };
    type Action2 = { type: "append"; text: string };

    const store1 = redux(create({ count: 0 }), (state, action: Action1) => {
      if (action.type === "increment") {
        return { count: state.count + 1 };
      }
      return state;
    });

    const store2 = redux(create({ value: "" }), (state, action: Action2) => {
      if (action.type === "append") {
        return { value: state.value + action.text };
      }
      return state;
    });

    store1.dispatch({ type: "increment" });
    store2.dispatch({ type: "append", text: "hello" });

    expect(store1.get()).toEqual({ count: 1 });
    expect(store2.get()).toEqual({ value: "hello" });
  });
});
