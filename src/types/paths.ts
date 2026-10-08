import type { Leaf } from './leaf.js';

/** Decrement table for the recursion depth limit. */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/** The `null | undefined` part of a type. */
export type Nullish<T> = Extract<T, null | undefined>;

/** Element type if `T` is an array, otherwise `T` itself. */
export type Elem<T> = T extends readonly (infer U)[] ? U : T;

/**
 * All dotted field paths of `T`, as MongoDB would address them.
 * Arrays are transparent: `orders.price` on `orders: { price: number }[]`.
 * Recursion stops at `Leaf` types and at depth `D` (default 5).
 */
export type Path<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends Leaf
    ? never
    : T extends readonly (infer U)[]
      ? Path<U, D>
      : T extends object
        ? {
            [K in keyof T & string]:
              | K
              | (NonNullable<T[K]> extends Leaf
                  ? never
                  : `${K}.${Path<NonNullable<T[K]>, Prev[D]>}`);
          }[keyof T & string]
        : never;

/**
 * Resolve the value type at dotted path `P` on `T`.
 * - Walking through an array maps the result: `orders.price` → `number[]`.
 * - Walking through an optional/nullable field propagates `undefined`/`null`.
 */
export type PathValue<T, P extends string> = T extends readonly (infer U)[]
  ? PathValue<U, P>[]
  : P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? PathValue<NonNullable<T[Head]>, Rest> | Nullish<T[Head]>
      : never
    : P extends keyof T
      ? T[P]
      : never;

/**
 * The *declared* type at dotted path `P`, stepping into array elements
 * instead of mapping over them. `orders.price` on `orders: { price: number }[]`
 * is `number` here (vs `number[]` for `PathValue`). Use this for questions
 * about the schema itself (e.g. "is this field an array?").
 */
export type PathType<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? PathType<Elem<NonNullable<T[Head]>>, Rest> | Nullish<T[Head]>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Paths of `T` that are declared as arrays (candidates for `$unwind`). */
export type ArrayPath<T> = {
  [P in Path<T>]: NonNullable<PathType<T, P>> extends readonly unknown[] ? P : never;
}[Path<T>];

/** A `$`-prefixed field reference usable inside expressions. */
export type FieldRef<T> = `$${Path<T>}`;

/** Strip the `$` from a field reference. */
export type RefPath<R extends string> = R extends `$${infer P}` ? P : never;
