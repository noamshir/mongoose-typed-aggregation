import type { EvalExpr, Expr } from './expressions.js';
import type { TypeError, UndefinedToNull } from './util.js';

/** Accumulator operators accepted inside `$group`. */
export type Accumulator<T> =
  | { readonly $sum: Expr<T> }
  | { readonly $avg: Expr<T> }
  | { readonly $min: Expr<T> }
  | { readonly $max: Expr<T> }
  | { readonly $first: Expr<T> }
  | { readonly $last: Expr<T> }
  | { readonly $push: Expr<T> }
  | { readonly $addToSet: Expr<T> }
  | { readonly $count: Record<string, never> };

/** Result type of accumulator `A` over documents of shape `T`. */
export type AccResult<T, A> =
  A extends { readonly $sum: unknown } ? number
  : A extends { readonly $count: unknown } ? number
  : A extends { readonly $avg: unknown } ? number | null
  : A extends { readonly $min: infer E } | { readonly $max: infer E }
    ? UndefinedToNull<EvalExpr<T, E>>
  : A extends { readonly $first: infer E } | { readonly $last: infer E }
    ? UndefinedToNull<EvalExpr<T, E>>
  : A extends { readonly $push: infer E } ? Exclude<EvalExpr<T, E>, undefined>[]
  : A extends { readonly $addToSet: infer E } ? Exclude<EvalExpr<T, E>, undefined>[]
  : A extends object
    ? keyof A extends `$${string}` ? TypeError<`Unsupported accumulator: ${keyof A & string}`> : never
  : never;
