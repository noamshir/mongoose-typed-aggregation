/** Every snippet in README.md, asserted — so the docs can't drift from the types. */
import { expectTypeOf } from 'expect-type';
import { Schema, model } from 'mongoose';
import { aggregate, Pipeline, type DocOf, type InferResult } from '../../src/index.js';
import { Invoice, User } from '../fixtures.js';

type UserDoc = DocOf<typeof User>;
type InvoiceDoc = DocOf<typeof Invoice>;

// ── hero example ────────────────────────────────────────────────────────────
{
  const rows = aggregate(User)
    .match({ active: true })
    .unwind('$orders')
    .group({ _id: '$orders.sku', total: { $sum: '$orders.price' }, buyers: { $addToSet: '$name' } })
    .addFields({ label: { $concat: ['sku:', '$_id'] } })
    .sort({ total: -1 })
    .limit(10)
    .exec();
  expectTypeOf(rows).resolves.toEqualTypeOf<{ _id: string; total: number; buyers: string[]; label: string }[]>();
}

// ── quick start ─────────────────────────────────────────────────────────────
{
  const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    age: Number,
    active: { type: Boolean, required: true },
    address: { city: { type: String, required: true }, zip: String },
    orders: [{ sku: { type: String, required: true }, price: { type: Number, required: true } }],
  });
  const QsUser = model('QsUser', userSchema);

  const pipeline = aggregate(QsUser)
    .match({ active: true })
    .addFields({ nOrders: { $size: '$orders' } })
    .project({ name: 1, nOrders: 1, city: '$address.city', _id: 0 })
    .sort({ nOrders: -1 });
  type Row = InferResult<typeof pipeline>;
  expectTypeOf<Row>().toEqualTypeOf<{ name: string; nOrders: number; city: string | null | undefined }>();
  expectTypeOf(pipeline.build()).toEqualTypeOf<import('mongoose').PipelineStage[]>();
}

// ── joins ───────────────────────────────────────────────────────────────────
{
  const rows = aggregate(User)
    .lookup({ from: Invoice, localField: '_id', foreignField: 'userId', as: 'invoices' })
    .lookup({
      from: Invoice,
      let: { uid: '$_id' },
      pipeline: (inv) => inv.match({ $expr: { $eq: ['$userId', '$$uid'] }, paid: true }).group({ _id: null, total: { $sum: '$amount' } }),
      as: 'paid',
    })
    .unwind({ path: '$paid', preserveNullAndEmptyArrays: true })
    .exec();
  type R = Awaited<typeof rows>[number];
  expectTypeOf<R['invoices']>().toEqualTypeOf<InvoiceDoc[]>();
  expectTypeOf<R['paid']>().toEqualTypeOf<{ _id: null; total: number } | null>();

  // @ts-expect-error foreignField checked against Invoice
  aggregate(User).lookup({ from: Invoice, localField: '_id', foreignField: 'name', as: 'x' });
}

// ── dotted keys ─────────────────────────────────────────────────────────────
{
  const p = aggregate(User)
    .addFields({ 'address.country': 'IL', 'orders.discounted': { $lt: ['$orders.price', 50] } })
    .project({ name: 1, 'address.city': 1 });
  type R = InferResult<typeof p>;
  expectTypeOf<R>().toEqualTypeOf<{ _id: import('mongoose').Types.ObjectId; name: string; address: { city: string } }>();
}

// ── conditional / reusable ──────────────────────────────────────────────────
{
  const onlyAdults = (p: Pipeline<UserDoc>) => p.match({ age: { $gte: 18 } });
  const withOrderStats = (p: Pipeline<UserDoc>) => p.addFields({ n: { $size: '$orders' } });
  const p = aggregate(User).when(Math.random() > 0.5, onlyAdults).pipe(withOrderStats);
  expectTypeOf<InferResult<typeof p>['n']>().toEqualTypeOf<number>();
}

// ── escape hatch ────────────────────────────────────────────────────────────
{
  const p = aggregate(User)
    .raw<{ bucket: number; n: number }>({ $bucketAuto: { groupBy: '$age', buckets: 5, output: { n: { $sum: 1 } } } })
    .sort({ n: -1 });
  expectTypeOf<InferResult<typeof p>>().toEqualTypeOf<{ bucket: number; n: number }>();
}

// ── explicit shape ──────────────────────────────────────────────────────────
{
  type MyLeanDoc = { _id: string; x: number };
  const p = new Pipeline<MyLeanDoc>(User).match({ x: 1 });
  expectTypeOf<InferResult<typeof p>>().toEqualTypeOf<MyLeanDoc>();
}
