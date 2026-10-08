import { Pipeline, type AnyModel } from './pipeline.js';
import type { DocOf } from './mongoose.js';

export { Pipeline } from './pipeline.js';

/** The output document type of a pipeline: `type Row = InferResult<typeof pipeline>`. */
export type InferResult<P> = P extends Pipeline<infer T> ? T : never;
export type { SortSpec, AnyModel } from './pipeline.js';
export type { DocOf, Lean, WithId } from './mongoose.js';
export type { Path, PathValue, PathType, ArrayPath, FieldRef, RefPath, Elem, Nullish } from './types/paths.js';
export type { Leaf, Primitive } from './types/leaf.js';
export type { Simplify, TypeError, SetPath, UndefinedToNull } from './types/util.js';
export type { Expr, EvalExpr, SystemVar } from './types/expressions.js';
export type { Accumulator, AccResult } from './types/accumulators.js';
export type { Unwind, UnwindOptions } from './types/stages/unwind.js';
export type { GroupSpec, GroupResult } from './types/stages/group.js';
export type { AddFieldsSpec, AddFieldsResult } from './types/stages/addFields.js';
export type { ProjectSpec, ProjectResult } from './types/stages/project.js';
export type { LookupResult, LookupEqualityOptions } from './types/stages/lookup.js';
export type { Assign, PickPaths, OmitPaths } from './types/dotted.js';

/**
 * Start a typed aggregation pipeline from a Mongoose model.
 *
 * ```ts
 * const rows = await aggregate(User).match({ active: true }).sort({ name: 1 }).exec();
 * //    ^? { _id: ObjectId; name: string; ... }[]
 * ```
 *
 * To start from an explicit shape instead of the model's inferred one:
 * `new Pipeline<MyShape>(model)`.
 */
export function aggregate<M extends AnyModel>(model: M): Pipeline<DocOf<M>> {
  return new Pipeline<DocOf<M>>(model);
}
