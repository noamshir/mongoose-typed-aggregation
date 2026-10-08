import type { Model, Types } from 'mongoose';

/**
 * Convert a Mongoose raw document type into the plain-object shape that
 * `aggregate()` actually returns: no Document methods, Mongoose array/map
 * wrappers flattened, `_id` required.
 */
export type Lean<T> = T extends Types.ObjectId | Types.Decimal128 | Date | RegExp | Uint8Array
  ? T
  : T extends Types.DocumentArray<infer U>
    ? Lean<U>[]
    : T extends Types.Array<infer U>
      ? Lean<U>[]
      : T extends readonly (infer U)[]
        ? Lean<U>[]
        : T extends Types.Map<infer V>
          ? Record<string, Lean<V>>
          : T extends Map<string, infer V>
            ? Record<string, Lean<V>>
            : T extends object
              ? { [K in keyof T]: Lean<T[K]> }
              : T;

/** Ensure `_id` is present (aggregation output always has it unless projected away). */
export type WithId<T> = T extends { _id: infer I }
  ? T
  : T extends { _id?: infer I }
    ? Omit<T, '_id'> & { _id: NonNullable<I> }
    : T & { _id: Types.ObjectId };

/** The document shape a pipeline starts from, given a Model. */
export type DocOf<M> = M extends Model<infer T, any, any, any, any, any> ? WithId<Lean<T>> : never;
