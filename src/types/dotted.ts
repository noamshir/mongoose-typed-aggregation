/**
 * Helpers for specs that use dotted keys (`'address.city': …`), as
 * `$project`, `$addFields` and `$unset` allow.
 */
import type { Nullish } from './paths.js';
import type { Simplify } from './util.js';

type DottedKey = `${string}.${string}`;

/** Keys of `V` with no dot. */
export type PlainKeys<V> = Exclude<keyof V & string, DottedKey>;
/** Keys of `V` with a dot. */
export type DottedKeys<V> = Extract<keyof V & string, DottedKey>;
/** First segment of every dotted key in the union `K`. */
export type Heads<K extends string> = K extends `${infer H}.${string}` ? H : never;
/** Remainder of the keys in `K` that start with `H.`. */
export type Tails<K extends string, H extends string> = K extends `${H}.${infer R}` ? R : never;

/** Same as `Tails`, but for an object spec: sub-spec under head `H`. */
type SubSpec<V, H extends string> = {
  [K in DottedKeys<V> as K extends `${H}.${infer R}` ? R : never]: V[K];
};

/** Step into `T[H]`, mapping over arrays (`arr.field` sets on every element). */
type Into<T, H extends string> = H extends keyof T ? NonNullable<T[H]> : {};

/**
 * Assign the (already evaluated) values in `V` onto `T`, honoring dotted keys.
 * `Assign<{ a: { b: 1 } }, { 'a.c': string; d: boolean }>` → `{ a: { b: 1; c: string }; d: boolean }`.
 * Through an array of documents the assignment applies to each element.
 */
export type Assign<T, V> = Simplify<
  Omit<T, PlainKeys<V> | Heads<DottedKeys<V>>> & { [K in PlainKeys<V>]: V[K] } & {
    [H in Heads<DottedKeys<V>>]: Into<T, H> extends readonly (infer E)[]
      ? Assign<E, SubSpec<V, H>>[]
      : Assign<Into<T, H>, SubSpec<V, H>>;
  }
>;

/**
 * Pick the paths `K` (plain or dotted) out of `T`, keeping nesting:
 * `PickPaths<{ a: { b: 1; c: 2 }; d: 3 }, 'a.b' | 'd'>` → `{ a: { b: 1 }; d: 3 }`.
 */
export type PickPaths<T, K extends string> = Simplify<
  Pick<T, Extract<K, keyof T>> & {
    [H in Heads<K> as H extends keyof T ? H : never]: H extends keyof T
      ? NonNullable<T[H]> extends readonly (infer E)[]
        ? PickPaths<E, Tails<K, H>>[]
        : PickPaths<NonNullable<T[H]>, Tails<K, H>> | Nullish<T[H]>
      : never;
  }
>;

/**
 * Remove the paths `K` (plain or dotted) from `T`, keeping nesting and
 * optionality of untouched parents.
 */
export type OmitPaths<T, K extends string> = Simplify<
  Omit<T, Extract<K, keyof T> | Heads<K>> & {
    [H in keyof T as H extends Heads<K> ? H : never]: NonNullable<T[H]> extends readonly (infer E)[]
      ? OmitPaths<E, Tails<K, H & string>>[]
      : OmitPaths<NonNullable<T[H]>, Tails<K, H & string>> | Nullish<T[H]>;
  }
>;
