import type { StoreListener, EqualFn } from "./create.js";

// pick

export function pick<K extends string = never>(...keys: readonly K[]) {
  return <T extends Record<K, any>>(object: T): Pretty<Pick<T, K>> => {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      result[key] = object[key];
    }
    return result;
  };
}

// omit

export function omit<K extends string = never>(...keys: readonly K[]) {
  return <T extends Record<K, any>>(object: T): Pretty<Omit<T, K>> => {
    const result = { ...object };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  };
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

// debounce

export function debounce<T extends any[]>(
  fn: (...args: T) => void,
  delay: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  };
  return Object.assign(
    (...args: T) => {
      cancel();
      timeout = setTimeout(() => fn(...args), delay);
    },
    { cancel }
  );
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

// deep

export function deep<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    a.constructor !== b.constructor
  ) {
    return false;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }
    for (const [key, value] of a) {
      if (!b.has(key) || !deep(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }
    for (const value of a) {
      if (!b.has(value)) {
        return false;
      }
    }
    return true;
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.byteLength !== b.byteLength || a.byteOffset !== b.byteOffset) {
      return false;
    }
    const viewA = new Uint8Array(a.buffer);
    const viewB = new Uint8Array(b.buffer);
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) {
        return false;
      }
    }
    return true;
  }
  if (a instanceof Error && b instanceof Error) {
    return (
      a.name === b.name && a.message === b.message && deep(a.cause, b.cause)
    );
  }
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (!deep(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

// Utils

export type Assign<T extends object, U> = Pretty<Omit<T, keyof U> & U>;

type Pretty<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>;
