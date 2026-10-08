import { expectTypeOf } from 'expect-type';
import type { Types } from 'mongoose';
import { aggregate, Pipeline, type DocOf } from '../../src/index.js';
import { User } from '../fixtures.js';

type UserDoc = DocOf<typeof User>;

// ── DocOf: lean shape with required _id, flattened arrays ───────────────────
expectTypeOf<UserDoc['_id']>().toEqualTypeOf<Types.ObjectId>();
expectTypeOf<UserDoc['name']>().toEqualTypeOf<string>();
expectTypeOf<UserDoc['active']>().toEqualTypeOf<boolean>();
expectTypeOf<UserDoc['createdAt']>().toEqualTypeOf<Date>();
expectTypeOf<UserDoc['orders'][number]['price']>().toEqualTypeOf<number>();
expectTypeOf<UserDoc['orders'][number]['sku']>().toEqualTypeOf<string>();

// ── Shape-preserving stages keep T ──────────────────────────────────────────
const p = aggregate(User)
  .match({ active: true, age: { $gte: 18 } })
  .sort({ 'address.city': 1, createdAt: -1 })
  .skip(10)
  .limit(5);

expectTypeOf(p).toEqualTypeOf<Pipeline<UserDoc>>();
expectTypeOf(p.exec()).resolves.toEqualTypeOf<UserDoc[]>();

// ── sort rejects unknown keys and bad directions ────────────────────────────
// @ts-expect-error unknown field
aggregate(User).sort({ nope: 1 });
// @ts-expect-error direction must be 1 | -1
aggregate(User).sort({ name: 2 });

// ── raw<R> re-types the pipeline (escape hatch) ─────────────────────────────
const counted = aggregate(User).raw<{ total: number }>({ $count: 'total' });
expectTypeOf(counted).toEqualTypeOf<Pipeline<{ total: number }>>();
expectTypeOf(counted.exec()).resolves.toEqualTypeOf<{ total: number }[]>();

// After raw, sort only accepts the new shape's paths.
counted.sort({ total: -1 });
// @ts-expect-error old shape is gone
counted.sort({ name: 1 });

// ── Explicit starting shape ─────────────────────────────────────────────────
type Custom = { x: number; y: { z: string } };
const custom = new Pipeline<Custom>(User).sort({ 'y.z': 1 });
expectTypeOf(custom.exec()).resolves.toEqualTypeOf<Custom[]>();

// ── build() is always the plain stage array ─────────────────────────────────
expectTypeOf(p.build()).toEqualTypeOf<import('mongoose').PipelineStage[]>();
