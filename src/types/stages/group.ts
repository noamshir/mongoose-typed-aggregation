import type { AccResult, Accumulator } from '../accumulators.js';
import type { EvalExpr, Expr } from '../expressions.js';
import type { Simplify } from '../util.js';

/** `$group` specification: `_id` is any expression (or `null`), other keys are accumulators. */
export type GroupSpec<T> = {
  readonly _id: Expr<T> | null;
} & {
  readonly [field: string]: Accumulator<T> | Expr<T> | null;
};

/** Output shape of `$group`. */
export type GroupResult<T, S> = Simplify<{
  -readonly [K in keyof S]: K extends '_id' ? EvalExpr<T, S[K]> : AccResult<T, S[K]>;
}>;
