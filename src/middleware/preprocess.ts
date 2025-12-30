import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { State, Store } from "../create.js";

export interface PreprocessOptions<T> {
  transform?: (state: T) => T;
  validate?:
    | ((state: T) => boolean | string | Promise<boolean | string>)
    | StandardSchemaV1<T>;
  blockOnValidationError?: boolean;
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void;
}

export function preprocess<S extends Store<any>>(
  store: S,
  options: PreprocessOptions<State<S>> = {}
) {
  const {
    transform,
    validate,
    blockOnValidationError = true,
    onValidationError
  } = options;
  const { set } = store;

  store.set = (nextState, ...args) => {
    nextState =
      typeof nextState === "function" ? nextState(store.get()) : nextState;
    if (transform) {
      nextState = transform(nextState);
    }
    let valid = true;
    if (typeof validate === "function") {
      const result = validate(nextState);

      const processResult = (result: boolean | string) => {
        if (typeof result === "string") {
          onValidationError?.([{ message: result }]);
          valid = false;
        } else if (!result) {
          onValidationError?.([{ message: "Validation failed" }]);
          valid = false;
        }
      };

      if (result instanceof Promise) {
        result.then(processResult);
      } else {
        processResult(result);
      }
    } else if (validate) {
      const result = validate["~standard"].validate(nextState);

      const processResult = (result: StandardSchemaV1.Result<State<S>>) => {
        if (!result.issues) {
          nextState = result.value;
        } else {
          onValidationError?.(result.issues);
          valid = false;
        }
      };

      if (result instanceof Promise) {
        result.then(processResult);
      } else {
        processResult(result);
      }
    }
    if (valid || !blockOnValidationError) {
      set(() => nextState, ...args);
    }
  };

  return store;
}
