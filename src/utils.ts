import type { StoreListener, EqualFn } from "./create";

// assign

export type Assign<T extends object, U> = Pretty<Omit<T, keyof U> & U>;

type Pretty<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>;

export function assign<T extends object, U>(a: T, b: U): Assign<T, U> {
  return Object.assign(a, b);
}

// createScope

export function createScope<T>(value: T) {
  return {
    get: () => value,
    set: (nextValue: T) => {
      value = nextValue;
    },
    act: <U>(scopedValue: T, fn: () => U) => {
      const saved = value;
      try {
        value = scopedValue;
        return fn();
      } finally {
        value = saved;
      }
    }
  };
}

// shallow

export function shallow<T>(a: T, b: T) {
  if (Object.is(a, b)) {
    return true;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

// slice

export function slice<T, U>(
  selector: (state: T) => U,
  listener: StoreListener<U>,
  equalFn: EqualFn<U> = Object.is
): StoreListener<T> {
  return (state, previousState) => {
    const slice = selector(state);
    const previousSlice = selector(previousState);
    if (!equalFn(previousSlice, slice)) {
      listener(slice, previousSlice);
    }
  };
}
