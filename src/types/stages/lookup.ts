import type { Path } from '../paths.js';
import type { Simplify } from '../util.js';

/** Equality-match form of `$lookup`. `from` is a Model so the joined shape `U` is known. */
export type LookupEqualityOptions<T, FromModel, U, As extends string> = {
  readonly from: FromModel;
  readonly localField: Path<T>;
  readonly foreignField: Path<U>;
  readonly as: As;
};

/** Output shape of `$lookup`: `T` plus `as: R[]` where `R` is the joined document shape. */
export type LookupResult<T, As extends string, R> = Simplify<Omit<T, As> & { [K in As]: R[] }>;
