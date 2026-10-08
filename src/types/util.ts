/** Flatten intersections and mapped types into a single readable object type. */
export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } & {} : T;

/** Branded error type: shows a readable message in hovers instead of a bare `never`. */
export type TypeError<Msg extends string> = { readonly __typeError: Msg };

/** Replace `undefined` with `null` (MongoDB never returns `undefined`). */
export type UndefinedToNull<T> = T extends undefined ? null : T;

/**
 * Set the type at dotted path `P` of `T` to `V`, creating the nested shape as needed.
 * `SetPath<{ a: { b: string[] } }, 'a.b', string>` → `{ a: { b: string } }`.
 */
export type SetPath<T, P extends string, V> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? Omit<T, Head> & { [K in Head]: SetPath<NonNullable<T[Head]>, Rest, V> }
    : T & { [K in Head]: SetPath<{}, Rest, V> }
  : Omit<T, P> & { [K in P]: V };
