import type { AggregateOptions, Model, PipelineStage, QueryFilter } from 'mongoose';
import type { OmitPaths } from './types/dotted.js';
import type { EvalExpr, Expr } from './types/expressions.js';
import type { DocOf } from './mongoose.js';
import type { ArrayPath, Path } from './types/paths.js';
import type { LookupResult } from './types/stages/lookup.js';
import type { Simplify } from './types/util.js';
import type { AddFieldsResult, AddFieldsSpec } from './types/stages/addFields.js';
import type { GroupResult, GroupSpec } from './types/stages/group.js';
import type { ProjectResult, ProjectSpec } from './types/stages/project.js';
import type { Unwind, UnwindOptions } from './types/stages/unwind.js';

/** Any Mongoose model, regardless of its schema/virtuals/statics generics. */
export type AnyModel = Model<any, any, any, any, any, any, any>;

/** `$sort` specification: only real paths of `T`, ascending or descending. */
export type SortSpec<T> = { [P in Path<T>]?: 1 | -1 };

/**
 * Immutable, fluent aggregation pipeline whose generic parameter `T` is the
 * shape of a single output document after all stages added so far.
 *
 * Every stage method returns a *new* `Pipeline` with an updated `T`; the
 * receiver is never mutated. At runtime the builder only collects plain
 * `PipelineStage` objects and hands them to `Model.aggregate()`.
 */
export class Pipeline<T> {
  readonly #model: AnyModel;
  readonly #stages: readonly PipelineStage[];

  constructor(model: AnyModel, stages: readonly PipelineStage[] = []) {
    this.#model = model;
    this.#stages = stages;
  }

  /** Append a stage and re-type the pipeline as `R`. */
  protected next<R>(stage: PipelineStage): Pipeline<R> {
    return new Pipeline<R>(this.#model, [...this.#stages, stage]);
  }

  // ───────────────────────── Shape-preserving stages ─────────────────────────

  /** `$match` — filter documents. Shape unchanged. */
  match(filter: QueryFilter<T>): Pipeline<T> {
    return this.next<T>({ $match: filter as PipelineStage.Match['$match'] });
  }

  /** `$sort` — keys must be real paths of `T`. Shape unchanged. */
  sort(spec: SortSpec<T>): Pipeline<T> {
    return this.next<T>({ $sort: spec as PipelineStage.Sort['$sort'] });
  }

  /** `$skip`. Shape unchanged. */
  skip(n: number): Pipeline<T> {
    return this.next<T>({ $skip: n });
  }

  /** `$limit`. Shape unchanged. */
  limit(n: number): Pipeline<T> {
    return this.next<T>({ $limit: n });
  }

  // ─────────────────────────── Reshaping stages ───────────────────────────

  /**
   * `$unwind` — flatten an array field. The field becomes its element type.
   * Accepts `'$path'` or `{ path, preserveNullAndEmptyArrays, includeArrayIndex }`.
   */
  unwind<P extends ArrayPath<T>>(path: `$${P}`): Pipeline<Unwind<T, P>>;
  unwind<
    P extends ArrayPath<T>,
    Preserve extends boolean = false,
    Idx extends string | undefined = undefined,
  >(options: {
    path: `$${P}`;
    preserveNullAndEmptyArrays?: Preserve;
    includeArrayIndex?: Idx;
  }): Pipeline<Unwind<T, P, Preserve, Idx>>;
  unwind(arg: string | UnwindOptions<T, ArrayPath<T>>): Pipeline<any> {
    return this.next<any>({ $unwind: arg as PipelineStage.Unwind["$unwind"] });
  }

  /** `$group` — `_id` is an expression (or `null`), every other key an accumulator. */
  group<const S extends GroupSpec<T>>(spec: S): Pipeline<GroupResult<T, S>> {
    return this.next<GroupResult<T, S>>({ $group: spec as PipelineStage.Group['$group'] });
  }

  /** `$addFields` — add or override fields with computed expressions. */
  addFields<const S extends AddFieldsSpec<T>>(spec: S): Pipeline<AddFieldsResult<T, S>> {
    return this.next<AddFieldsResult<T, S>>({ $addFields: spec as PipelineStage.AddFields['$addFields'] });
  }

  /** `$set` — alias of `$addFields`. */
  set<const S extends AddFieldsSpec<T>>(spec: S): Pipeline<AddFieldsResult<T, S>> {
    return this.next<AddFieldsResult<T, S>>({ $set: spec as PipelineStage.Set['$set'] });
  }

  /** `$project` — include (`1`), exclude (`0`) or compute fields. */
  project<const S extends ProjectSpec<T>>(spec: S): Pipeline<ProjectResult<T, S>> {
    return this.next<ProjectResult<T, S>>({ $project: spec as PipelineStage.Project['$project'] });
  }

  /** `$unset` — remove fields (plain or dotted paths). */
  unset<P extends Path<T>>(...paths: [P, ...P[]]): Pipeline<OmitPaths<T, P>> {
    return this.next<OmitPaths<T, P>>({ $unset: paths.length === 1 ? paths[0] : paths });
  }

  /**
   * `$replaceRoot` — promote an expression (usually an embedded document) to the root.
   * The result is non-nullable because MongoDB errors at runtime when it resolves to null/missing.
   */
  replaceRoot<const E extends Expr<T>>(newRoot: E): Pipeline<Simplify<NonNullable<EvalExpr<T, E>>>> {
    return this.next<Simplify<NonNullable<EvalExpr<T, E>>>>({
      $replaceRoot: { newRoot: newRoot as PipelineStage.ReplaceRoot['$replaceRoot']['newRoot'] },
    });
  }

  /** `$replaceWith` — same as `replaceRoot`, newer syntax. */
  replaceWith<const E extends Expr<T>>(expr: E): Pipeline<Simplify<NonNullable<EvalExpr<T, E>>>> {
    return this.next<Simplify<NonNullable<EvalExpr<T, E>>>>({
      $replaceWith: expr as PipelineStage.ReplaceWith['$replaceWith'],
    });
  }

  // ───────────────────────────────── Joins ────────────────────────────────

  /**
   * `$lookup` — join another collection. `from` is a Mongoose **Model**, not a
   * collection name, which is what makes the joined shape known.
   *
   * Equality form: `{ from, localField, foreignField, as }` → `as: DocOf<from>[]`.
   * Pipeline form:  `{ from, let?, pipeline: p => p.match(...)..., as }` → `as: <pipeline output>[]`.
   */
  lookup<From extends AnyModel, As extends string>(options: {
    from: From;
    localField: Path<T>;
    foreignField: Path<DocOf<From>>;
    as: As;
  }): Pipeline<LookupResult<T, As, DocOf<From>>>;
  lookup<From extends AnyModel, As extends string, R>(options: {
    from: From;
    let?: Record<string, Expr<T>>;
    localField?: Path<T>;
    foreignField?: Path<DocOf<From>>;
    pipeline: (p: Pipeline<DocOf<From>>) => Pipeline<R>;
    as: As;
  }): Pipeline<LookupResult<T, As, R>>;
  lookup(options: {
    from: AnyModel;
    let?: Record<string, unknown>;
    localField?: string;
    foreignField?: string;
    pipeline?: (p: Pipeline<any>) => Pipeline<any>;
    as: string;
  }): Pipeline<any> {
    const { from, pipeline, ...rest } = options;
    const stage: Record<string, unknown> = { ...rest, from: from.collection.name };
    if (pipeline) stage['pipeline'] = pipeline(new Pipeline<any>(from)).build();
    return this.next<any>({ $lookup: stage as PipelineStage.Lookup['$lookup'] });
  }

  // ─────────────────────────────── Composition ────────────────────────────

  /**
   * Conditionally apply stages. When `condition` is false the pipeline is
   * returned unchanged. The output type is `T | R` — identical to `T` when the
   * branch only filters/sorts, a union when it reshapes.
   */
  when<R>(condition: boolean, build: (p: Pipeline<T>) => Pipeline<R>): Pipeline<T | R> {
    return condition ? (build(this) as Pipeline<T | R>) : (this as Pipeline<T | R>);
  }

  /** Apply a reusable fragment: `p.pipe(withActiveUsers)` ≡ `withActiveUsers(p)`. */
  pipe<R>(fragment: (p: Pipeline<T>) => Pipeline<R>): Pipeline<R> {
    return fragment(this);
  }

  /** `$count` — collapse to a single `{ [field]: number }` document. */
  count<F extends string>(field: F): Pipeline<{ [K in F]: number }> {
    return this.next<{ [K in F]: number }>({ $count: field });
  }

  // ───────────────────────────── Escape hatch ─────────────────────────────

  /**
   * Append any raw stage and declare the resulting shape yourself.
   * This is an assertion, not a check — use it for stages the builder does
   * not model yet.
   */
  raw<R = T>(stage: PipelineStage): Pipeline<R> {
    return this.next<R>(stage);
  }

  // ───────────────────────────── Terminal ops ─────────────────────────────

  /** The plain stage array, ready for `Model.aggregate()`. */
  build(): PipelineStage[] {
    return [...this.#stages];
  }

  /** Run the pipeline. */
  exec(options?: AggregateOptions): Promise<T[]> {
    const agg = this.#model.aggregate<T>(this.build());
    if (options) agg.option(options);
    return agg.exec();
  }
}
