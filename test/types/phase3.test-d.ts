import { expectTypeOf } from 'expect-type';
import type { Types } from 'mongoose';
import { aggregate, Pipeline, type DocOf, type InferResult } from '../../src/index.js';
import { Invoice, User } from '../fixtures.js';

type Doc = {
  _id: Types.ObjectId;
  name: string;
  age?: number;
  address: { city: string; zip?: string; geo?: { lat: number; lng: number } };
  orders: { sku: string; price: number; tags: string[] }[];
  createdAt: Date;
};
const start = new Pipeline<Doc>(User);
type Out<P> = InferResult<P>;
type InvoiceDoc = DocOf<typeof Invoice>;

// ── lookup: equality form ───────────────────────────────────────────────────
{
  const p = aggregate(User).lookup({ from: Invoice, localField: '_id', foreignField: 'userId', as: 'invoices' });
  type R = Out<typeof p>;
  expectTypeOf<R['invoices']>().toEqualTypeOf<InvoiceDoc[]>();
  expectTypeOf<R['invoices'][number]['amount']>().toEqualTypeOf<number>();
  expectTypeOf<R['name']>().toEqualTypeOf<string>();

  // joined array can be unwound, and its paths are known
  const one = p.unwind('$invoices').sort({ 'invoices.amount': -1 });
  expectTypeOf<Out<typeof one>['invoices']>().toEqualTypeOf<InvoiceDoc>();

  // @ts-expect-error foreignField must be a path of the *foreign* model
  aggregate(User).lookup({ from: Invoice, localField: '_id', foreignField: 'name', as: 'x' });
  // @ts-expect-error localField must be a path of the local shape
  aggregate(User).lookup({ from: Invoice, localField: 'nope', foreignField: 'userId', as: 'x' });
}

// ── lookup: pipeline form (typed sub-pipeline) ──────────────────────────────
{
  const p = aggregate(User).lookup({
    from: Invoice,
    let: { uid: '$_id' },
    pipeline: (inv) =>
      inv
        .match({ $expr: { $eq: ['$userId', '$$uid'] }, paid: true })
        .group({ _id: null, total: { $sum: '$amount' }, n: { $count: {} } })
        .project({ _id: 0, total: 1, n: 1 }),
    as: 'paid',
  });
  expectTypeOf<Out<typeof p>['paid']>().toEqualTypeOf<{ total: number; n: number }[]>();

  // the sub-pipeline is typed against the foreign model
  aggregate(User).lookup({
    from: Invoice,
    // @ts-expect-error `name` is not a field of Invoice
    pipeline: (inv) => inv.sort({ name: 1 }),
    as: 'x',
  });
}

// ── replaceRoot / replaceWith ───────────────────────────────────────────────
{
  const r = start.replaceRoot('$address');
  expectTypeOf<Out<typeof r>>().toEqualTypeOf<{ city: string; zip?: string; geo?: { lat: number; lng: number } }>();

  const merged = start.replaceWith({ $mergeObjects: ['$address', { name: '$name', zip: 42 }] });
  expectTypeOf<Out<typeof merged>>().toEqualTypeOf<{ city: string; geo?: { lat: number; lng: number }; name: string; zip: number }>();

  const u = start.unwind('$orders').replaceRoot('$orders');
  expectTypeOf<Out<typeof u>>().toEqualTypeOf<{ sku: string; price: number; tags: string[] }>();
}

// ── when / pipe ─────────────────────────────────────────────────────────────
{
  const flag = Math.random() > 0.5;
  // filter-only branch → same shape
  const same = start.when(flag, (p) => p.match({ age: { $gte: 18 } }).sort({ name: 1 }));
  expectTypeOf(same).toEqualTypeOf<Pipeline<Doc>>();

  // reshaping branch → union
  const reshaped = start.when(flag, (p) => p.project({ name: 1, _id: 0 }));
  expectTypeOf<Out<typeof reshaped>>().toEqualTypeOf<Doc | { name: string }>();

  const frag = (p: Pipeline<Doc>) => p.addFields({ n: { $size: '$orders' } });
  const piped = start.pipe(frag);
  expectTypeOf<Out<typeof piped>['n']>().toEqualTypeOf<number>();
}

// ── unset ───────────────────────────────────────────────────────────────────
{
  const u = start.unset('orders', 'address.zip', 'createdAt');
  expectTypeOf<Out<typeof u>>().toEqualTypeOf<{ _id: Types.ObjectId; name: string; age?: number; address: { city: string; geo?: { lat: number; lng: number } } }>();
  // @ts-expect-error unknown path
  start.unset('nope');
}

// ── dotted keys: addFields ──────────────────────────────────────────────────
{
  const a = start.addFields({ 'address.country': 'IL', 'address.geo.lat': 0, 'orders.discounted': { $lt: ['$orders.price', 50] }, top: 1 });
  type A = Out<typeof a>;
  expectTypeOf<A['address']>().toEqualTypeOf<{ city: string; zip?: string; country: string; geo: { lng: number; lat: number } }>();
  expectTypeOf<A['orders'][number]>().toEqualTypeOf<{ sku: string; price: number; tags: string[]; discounted: boolean }>();
  expectTypeOf<A['top']>().toEqualTypeOf<number>();
  expectTypeOf<A['name']>().toEqualTypeOf<string>();
}

// ── dotted keys: project ────────────────────────────────────────────────────
{
  const inc = start.project({ name: 1, 'address.city': 1, 'orders.sku': 1 });
  expectTypeOf<Out<typeof inc>>().toEqualTypeOf<{ _id: Types.ObjectId; name: string; address: { city: string }; orders: { sku: string }[] }>();

  const exc = start.project({ 'address.zip': 0, 'orders.tags': 0, createdAt: 0 });
  type E = Out<typeof exc>;
  expectTypeOf<E['address']>().toEqualTypeOf<{ city: string; geo?: { lat: number; lng: number } }>();
  expectTypeOf<E['orders']>().toEqualTypeOf<{ sku: string; price: number }[]>();
  expectTypeOf<E['name']>().toEqualTypeOf<string>();

  const comp = start.project({ _id: 0, 'loc.city': '$address.city', 'loc.n': { $size: '$orders' } });
  expectTypeOf<Out<typeof comp>>().toEqualTypeOf<{ loc: { city: string; n: number } }>();
}
