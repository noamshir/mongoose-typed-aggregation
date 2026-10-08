import type { Assign } from '../dotted.js';
import type { EvalExpr, Expr } from '../expressions.js';

/** `$addFields` / `$set` specification. Dotted keys set nested fields. */
export type AddFieldsSpec<T> = { readonly [field: string]: Expr<T> };

/** Evaluate every value of the spec against the input shape. */
type Evaluated<T, S> = { -readonly [K in keyof S]: EvalExpr<T, S[K]> };

/** Output shape of `$addFields`: existing fields, with the computed ones assigned on top. */
export type AddFieldsResult<T, S> = Assign<T, Evaluated<T, S>>;
