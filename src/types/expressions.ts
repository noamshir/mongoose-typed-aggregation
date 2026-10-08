import type { Types } from 'mongoose';
import type { Elem, FieldRef, Path, PathValue } from './paths.js';
import type { Simplify, TypeError } from './util.js';

// ─────────────────────────────── Input side ────────────────────────────────

/**
 * What the user may write as an aggregation expression over documents of
 * shape `T`. Field references autocomplete; everything else is permissive
 * and gets its type from `EvalExpr`.
 */
export type Expr<T> =
  | FieldRef<T>
  | SystemVar
  | (string & {})
  | number
  | boolean
  | null
  | Date
  | Types.ObjectId
  | readonly Expr<T>[]
  | { readonly [key: string]: Expr<T> };

/** Aggregation system variables we understand. */
export type SystemVar = '$$ROOT' | '$$CURRENT' | '$$NOW';

// ─────────────────────────────── Output side ───────────────────────────────

type StringOps =
  | '$concat' | '$toUpper' | '$toLower' | '$toString' | '$substr' | '$substrCP'
  | '$substrBytes' | '$trim' | '$ltrim' | '$rtrim' | '$dateToString' | '$replaceAll'
  | '$replaceOne';

type NumberOps =
  | '$add' | '$subtract' | '$multiply' | '$divide' | '$mod' | '$abs' | '$ceil'
  | '$floor' | '$round' | '$trunc' | '$sqrt' | '$pow' | '$exp' | '$ln' | '$log10'
  | '$size' | '$strLenCP' | '$strLenBytes' | '$indexOfArray' | '$indexOfCP'
  | '$toInt' | '$toDouble' | '$toLong' | '$toDecimal'
  | '$year' | '$month' | '$dayOfMonth' | '$hour' | '$minute' | '$second'
  | '$millisecond' | '$dayOfWeek' | '$dayOfYear' | '$week' | '$isoWeek'
  | '$isoWeekYear' | '$isoDayOfWeek' | '$dateDiff';

type BooleanOps =
  | '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$and' | '$or'
  | '$not' | '$toBool' | '$isArray' | '$isNumber' | '$regexMatch' | '$allElementsTrue'
  | '$anyElementTrue';

/** Right-biased shallow merge, like `$mergeObjects`. */
type MergeObjects<A, B> = Simplify<Omit<A, keyof B> & B>;

/** Does object type `E` have at least one key from `K`? */
type Has<E, K extends string> = [Extract<keyof E, K>] extends [never] ? false : true;

/**
 * The result type of evaluating expression `E` against documents of shape `T`.
 * Operators we don't model evaluate to `unknown` (never `any`).
 */
export type EvalExpr<T, E> =
  // ── system variables ──
  E extends '$$ROOT' | '$$CURRENT' ? T
  : E extends '$$NOW' ? Date
  : E extends `$$${string}` ? unknown
  // ── field references ──
  : E extends `$${infer P}`
    ? P extends Path<T> ? PathValue<T, P> : TypeError<`Unknown field path: ${P}`>
  // ── literals ──
  : E extends string ? string
  : E extends number ? number
  : E extends boolean ? boolean
  : E extends null ? null
  : E extends Date ? Date
  : E extends Types.ObjectId ? Types.ObjectId
  // ── operators with special result shapes ──
  : E extends { readonly $literal: infer L } ? L
  : E extends { readonly $ifNull: readonly [infer A, infer B] }
    ? NonNullable<EvalExpr<T, A>> | EvalExpr<T, B>
  : E extends { readonly $cond: readonly [unknown, infer A, infer B] }
    ? EvalExpr<T, A> | EvalExpr<T, B>
  : E extends { readonly $cond: { readonly if: unknown; readonly then: infer A; readonly else: infer B } }
    ? EvalExpr<T, A> | EvalExpr<T, B>
  : E extends { readonly $arrayElemAt: readonly [infer A, unknown] }
    ? Elem<NonNullable<EvalExpr<T, A>>> | null
  : E extends { readonly $first: infer A } ? Elem<NonNullable<EvalExpr<T, A>>> | null
  : E extends { readonly $last: infer A } ? Elem<NonNullable<EvalExpr<T, A>>> | null
  : E extends { readonly $mergeObjects: readonly [infer A, infer B, infer C] }
    ? MergeObjects<MergeObjects<NonNullable<EvalExpr<T, A>>, NonNullable<EvalExpr<T, B>>>, NonNullable<EvalExpr<T, C>>>
  : E extends { readonly $mergeObjects: readonly [infer A, infer B] }
    ? MergeObjects<NonNullable<EvalExpr<T, A>>, NonNullable<EvalExpr<T, B>>>
  : E extends { readonly $toObjectId: unknown } ? Types.ObjectId
  : E extends { readonly $toDate: unknown } ? Date
  : E extends { readonly $dateAdd: unknown } | { readonly $dateSubtract: unknown } ? Date
  : E extends { readonly $split: unknown } ? string[]
  : E extends { readonly $objectToArray: unknown } ? { k: string; v: unknown }[]
  : E extends { readonly $setUnion: unknown } | { readonly $setIntersection: unknown } ? unknown[]
  : E extends { readonly $concatArrays: readonly (infer A)[] } ? Elem<NonNullable<EvalExpr<T, A>>>[]
  : E extends { readonly $slice: readonly [infer A, ...unknown[]] } ? NonNullable<EvalExpr<T, A>>
  : E extends { readonly $filter: { readonly input: infer A } } ? NonNullable<EvalExpr<T, A>>
  : E extends { readonly $reverseArray: infer A } ? NonNullable<EvalExpr<T, A>>
  // ── operators grouped by result primitive ──
  : Has<E, StringOps> extends true ? string
  : Has<E, NumberOps> extends true ? number
  : Has<E, BooleanOps> extends true ? boolean
  // ── unknown operator → unknown ──
  : E extends object
    ? keyof E extends `$${string}`
      ? unknown
      // ── array / object literals evaluate element-wise ──
      : E extends readonly (infer A)[]
        ? EvalExpr<T, A>[]
        : { -readonly [K in keyof E]: EvalExpr<T, E[K]> }
  : unknown;
