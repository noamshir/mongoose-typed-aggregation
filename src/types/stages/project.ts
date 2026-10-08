import type { Assign, OmitPaths, PickPaths } from '../dotted.js';
import type { EvalExpr, Expr } from '../expressions.js';

/** `$project` specification: include (`1`/`true`), exclude (`0`/`false`) or compute. Dotted keys allowed. */
export type ProjectSpec<T> = { readonly [field: string]: 0 | 1 | boolean | Expr<T> };

type IncludedKeys<S> = { [K in keyof S]: S[K] extends 1 | true ? K : never }[keyof S] & string;
type ExcludedKeys<S> = { [K in keyof S]: S[K] extends 0 | false ? K : never }[keyof S] & string;
type ComputedKeys<S> = { [K in keyof S]: S[K] extends 0 | 1 | boolean ? never : K }[keyof S] & string;

/** Exclusion mode = every key in the spec is `0`/`false`. */
type IsExclusion<S> = [Exclude<keyof S, ExcludedKeys<S>>] extends [never] ? true : false;

/** In inclusion mode `_id` is kept unless the spec mentions it. */
type KeptId<T, S> = '_id' extends keyof S ? never : '_id' extends keyof T ? '_id' : never;

type Computed<T, S> = { -readonly [K in ComputedKeys<S>]: EvalExpr<T, S[K]> };

/** Output shape of `$project`. */
export type ProjectResult<T, S> = IsExclusion<S> extends true
  ? OmitPaths<T, ExcludedKeys<S>>
  : Assign<PickPaths<T, IncludedKeys<S> | KeptId<T, S>>, Computed<T, S>>;
