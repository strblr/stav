import type { StoreListener, EqualFn } from "./create";

// shallow

export function shallow<T>(a: T, b: T): boolean {
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
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys as Set<keyof T>) {
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
