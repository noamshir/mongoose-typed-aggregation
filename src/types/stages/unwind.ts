import type { ArrayPath, Elem, PathType } from '../paths.js';
import type { SetPath, Simplify } from '../util.js';

/** Options object form of `$unwind`. */
export type UnwindOptions<T, P extends ArrayPath<T>> = {
  readonly path: `$${P}`;
  readonly includeArrayIndex?: string;
  readonly preserveNullAndEmptyArrays?: boolean;
};

/**
 * Shape after `$unwind` on array path `P`:
 * the array becomes its element type; with `preserveNullAndEmptyArrays`
 * the field may also be `null`; with `includeArrayIndex` a number field is added.
 */
export type Unwind<
  T,
  P extends string,
  Preserve extends boolean = false,
  Idx extends string | undefined = undefined,
> = Simplify<
  SetPath<T, P, Elem<NonNullable<PathType<T, P>>> | (Preserve extends true ? null : never)> &
    (Idx extends string ? { [K in Idx]: Preserve extends true ? number | null : number } : {})
>;
