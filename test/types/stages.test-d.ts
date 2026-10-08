import { expectTypeOf } from 'expect-type';
import type { Types } from 'mongoose';
import { Pipeline, type EvalExpr, type TypeError } from '../../src/index.js';
import { User } from '../fixtures.js';

type Doc = {
  _id: Types.ObjectId;
  name: string;
  age?: number;
  address: { city: string; zip?: string };
  orders: { sku: string; price: number; tags: string[] }[];
  createdAt: Date;
};
const start = new Pipeline<Doc>(User);
type Out<P> = P extends Pipeline<infer T> ? T : never;

// ── unwind ──────────────────────────────────────────────────────────────────
{
  const p = start.unwind('$orders');
  expectTypeOf<Out<typeof p>['orders']>().toEqualTypeOf<{ sku: string; price: number; tags: string[] }>();
  expectTypeOf<Out<typeof p>['name']>().toEqualTypeOf<string>();

  const preserved = start.unwind({ path: '$orders', preserveNullAndEmptyArrays: true, includeArrayIndex: 'i' });
  expectTypeOf<Out<typeof preserved>['orders']>().toEqualTypeOf<{ sku: string; price: number; tags: string[] } | null>();
  expectTypeOf<Out<typeof preserved>['i']>().toEqualTypeOf<number | null>();

  // nested array path, after the outer unwind
  const tags = p.unwind('$orders.tags');
  expectTypeOf<Out<typeof tags>['orders']['tags']>().toEqualTypeOf<string>();

  // @ts-expect-error not an array field
  start.unwind('$name');
  // @ts-expect-error unknown field
  start.unwind('$nope');
}

// ── group ───────────────────────────────────────────────────────────────────
{
  const g = start.unwind('$orders').group({
    _id: '$orders.sku',
    total: { $sum: '$orders.price' },
    avg: { $avg: '$orders.price' },
    n: { $count: {} },
    first: { $first: '$name' },
    oldest: { $min: '$createdAt' },
    ages: { $push: '$age' },
    names: { $addToSet: '$name' },
  });
  expectTypeOf<Out<typeof g>>().toEqualTypeOf<{
    _id: string;
    total: number;
    avg: number | null;
    n: number;
    first: string;
    oldest: Date;
    ages: number[];
    names: string[];
  }>();

  // _id: null and compound _id
  const all = start.group({ _id: null, c: { $sum: 1 } });
  expectTypeOf<Out<typeof all>>().toEqualTypeOf<{ _id: null; c: number }>();

  const compound = start.group({ _id: { city: '$address.city', zip: '$address.zip' }, c: { $sum: 1 } });
  expectTypeOf<Out<typeof compound>>().toEqualTypeOf<{ _id: { city: string; zip: string | undefined }; c: number }>();

  // optional field through $first becomes null, not undefined
  const opt = start.group({ _id: null, age: { $first: '$age' } });
  expectTypeOf<Out<typeof opt>['age']>().toEqualTypeOf<number | null>();

  // unknown path → readable error type instead of silent any
  const bad = start.group({ _id: '$nope', c: { $sum: 1 } });
  expectTypeOf<Out<typeof bad>['_id']>().toEqualTypeOf<TypeError<'Unknown field path: nope'>>();

  // old fields are gone after group
  // @ts-expect-error
  g.sort({ name: 1 });
  g.sort({ total: -1 });
}

// ── addFields / set ─────────────────────────────────────────────────────────
{
  const a = start.addFields({
    label: { $concat: ['user:', '$name'] },
    nOrders: { $size: '$orders' },
    isAdult: { $gte: ['$age', 18] },
    ageOrZero: { $ifNull: ['$age', 0] },
    tier: { $cond: [{ $gt: ['$age', 60] }, 'senior', 'regular'] },
    firstOrder: { $arrayElemAt: ['$orders', 0] },
    year: { $year: '$createdAt' },
    name: 42, // override an existing field
    whole: '$$ROOT',
  });
  type A = Out<typeof a>;
  expectTypeOf<A['label']>().toEqualTypeOf<string>();
  expectTypeOf<A['nOrders']>().toEqualTypeOf<number>();
  expectTypeOf<A['isAdult']>().toEqualTypeOf<boolean>();
  expectTypeOf<A['ageOrZero']>().toEqualTypeOf<number>();
  expectTypeOf<A['tier']>().toEqualTypeOf<string>();
  expectTypeOf<A['firstOrder']>().toEqualTypeOf<{ sku: string; price: number; tags: string[] } | null>();
  expectTypeOf<A['year']>().toEqualTypeOf<number>();
  expectTypeOf<A['name']>().toEqualTypeOf<number>();
  expectTypeOf<A['whole']>().toEqualTypeOf<Doc>();
  expectTypeOf<A['address']>().toEqualTypeOf<Doc['address']>(); // untouched

  // unmodelled operator → unknown
  const u = start.set({ x: { $someFutureOp: 1 } });
  expectTypeOf<Out<typeof u>['x']>().toEqualTypeOf<unknown>();
}

// ── project ─────────────────────────────────────────────────────────────────
{
  const inc = start.project({ name: 1, age: true });
  expectTypeOf<Out<typeof inc>>().toEqualTypeOf<{ _id: Types.ObjectId; name: string; age?: number }>();

  const noId = start.project({ name: 1, _id: 0 });
  expectTypeOf<Out<typeof noId>>().toEqualTypeOf<{ name: string }>();

  const exc = start.project({ orders: 0, createdAt: 0 });
  expectTypeOf<Out<typeof exc>>().toEqualTypeOf<{ _id: Types.ObjectId; name: string; age?: number; address: Doc['address'] }>();

  const computed = start.project({ name: 1, city: '$address.city', n: { $size: '$orders' } });
  expectTypeOf<Out<typeof computed>>().toEqualTypeOf<{ _id: Types.ObjectId; name: string; city: string; n: number }>();
}

// ── count ───────────────────────────────────────────────────────────────────
{
  const c = start.match({ active: true }).count('total');
  expectTypeOf<Out<typeof c>>().toEqualTypeOf<{ total: number }>();
}

// ── EvalExpr directly ───────────────────────────────────────────────────────
expectTypeOf<EvalExpr<Doc, '$orders.price'>>().toEqualTypeOf<number[]>();
expectTypeOf<EvalExpr<Doc, ['$name', '$age']>>().toEqualTypeOf<(string | number | undefined)[]>();
expectTypeOf<EvalExpr<Doc, { $literal: '$name' }>>().toEqualTypeOf<'$name'>();
