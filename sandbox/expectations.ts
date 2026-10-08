/**
 * Compile-time assertions for the pipelines in playground.ts.
 * If a hover comment there drifts from reality, this file fails `npm run sandbox`.
 */
import { expectTypeOf } from 'expect-type';
import { aggregate, type InferResult, Pipeline } from '../src/index.js';
import { Invoice, User } from './schema.js';

const revenueBySku = aggregate(User).match({ active: true }).unwind('$orders')
  .group({ _id: '$orders.sku', revenue: { $sum: { $multiply: ['$orders.price', '$orders.qty'] } }, units: { $sum: '$orders.qty' }, buyers: { $addToSet: '$name' }, lastOrder: { $max: '$orders.placedAt' } })
  .addFields({ label: { $concat: ['sku:', '$_id'] }, avgPrice: { $divide: ['$revenue', '$units'] } }).sort({ revenue: -1 });
expectTypeOf<InferResult<typeof revenueBySku>>().toEqualTypeOf<{ _id: string; revenue: number; units: number; buyers: string[]; lastOrder: Date; label: string; avgPrice: number }>();

const userSummary = aggregate(User)
  .addFields({ nOrders: { $size: '$orders' }, isAdult: { $gte: ['$age', 18] }, ageOrUnknown: { $ifNull: ['$age', 'unknown'] }, tier: { $cond: [{ $gte: [{ $size: '$orders' }, 2] }, 'gold', 'basic'] } })
  .project({ name: 1, nOrders: 1, isAdult: 1, ageOrUnknown: 1, tier: 1, city: '$address.city', _id: 0 }).sort({ nOrders: -1 });
expectTypeOf<InferResult<typeof userSummary>>().toEqualTypeOf<{ name: string; nOrders: number; isAdult: boolean; ageOrUnknown: number | string; tier: string; city: string | null | undefined }>();

const withEmpty = aggregate(User).unwind({ path: '$orders', preserveNullAndEmptyArrays: true, includeArrayIndex: 'orderIdx' }).project({ name: 1, orderIdx: 1, sku: '$orders.sku', _id: 0 });
expectTypeOf<InferResult<typeof withEmpty>>().toEqualTypeOf<{ name: string; orderIdx: number | null; sku: string | null }>();

const activeCount = aggregate(User).match({ active: true }).count('active');
expectTypeOf(activeCount).toEqualTypeOf<Pipeline<{ active: number }>>();

const withInvoices = aggregate(User)
  .lookup({ from: Invoice, localField: 'email', foreignField: 'userEmail', as: 'invoices' })
  .lookup({ from: Invoice, let: { email: '$email' }, pipeline: (inv) => inv.match({ $expr: { $eq: ['$userEmail', '$$email'] }, paid: true }).group({ _id: null, total: { $sum: '$amount' }, n: { $count: {} } }).project({ _id: 0, total: 1, n: 1 }), as: 'paid' })
  .addFields({ paidTotal: { $ifNull: [{ $arrayElemAt: ['$paid.total', 0] }, 0] } })
  .project({ name: 1, _id: 0, 'invoices.number': 1, 'invoices.amount': 1, paidTotal: 1 });
expectTypeOf<InferResult<typeof withInvoices>>().toEqualTypeOf<{ name: string; invoices: { number: string; amount: number }[]; paidTotal: number }>();

const addresses = aggregate(User).when(true as boolean, (p) => p.match({ 'address.country': 'IL' })).replaceWith({ $mergeObjects: ['$address', { who: '$name' }] });
expectTypeOf<InferResult<typeof addresses>>().toEqualTypeOf<{ city: string; country: string; zip?: string | null; who: string }>();
