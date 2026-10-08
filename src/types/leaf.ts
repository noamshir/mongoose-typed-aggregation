import type { Types } from 'mongoose';

/** Primitive values. */
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Types that path resolution never recurses into.
 * Anything structurally assignable here is treated as a single field value
 * (e.g. `Buffer` is a `Uint8Array`, `Types.ObjectId` is listed explicitly).
 */
export type Leaf =
  | Primitive
  | Date
  | RegExp
  | Types.ObjectId
  | Types.Decimal128
  | Uint8Array
  | Map<unknown, unknown>
  | ((...args: never[]) => unknown);
