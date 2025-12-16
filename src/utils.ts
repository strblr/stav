import type { ChangeListener } from "./create";

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
  for (const key of keys) {
    if (!Object.is(a[key as keyof T], b[key as keyof T])) {
      return false;
    }
  }
  return true;
}

export function slice<T, U>(
  selector: (state: T) => U,
  callback: ChangeListener<U>,
  equalFn: (slice: U, nextSlice: U) => boolean = Object.is
): ChangeListener<T> {
  return (state, previousState) => {
    const slice = selector(state);
    const previousSlice = selector(previousState);
    if (!equalFn(previousSlice, slice)) {
      callback(slice, previousSlice);
    }
  };
}
