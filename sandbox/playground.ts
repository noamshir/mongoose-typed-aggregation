/**
 * Playground for mongoose-typed-aggregation.
 *
 *   npm run sandbox       → type-check this file (hover the `^?` lines in your editor)
 *   npm run sandbox:run   → execute against a real MongoDB
 *                           (MONGO_URI env var, default mongodb://127.0.0.1:27017/typed-agg-sandbox)
 *
 * Imports come straight from ../src so changes to the library show up immediately.
 */
import mongoose from 'mongoose';
import { aggregate, type InferResult } from '../src/index.js';
import { Invoice, User, invoiceSeed, seed } from './schema.js';

// ───────────────────────────── 1. Build pipelines ─────────────────────────────

/** Revenue per SKU across active users. */
const revenueBySku = aggregate(User)
  .match({ active: true })
  .unwind('$orders')
  .group({
    _id: '$orders.sku',
    revenue: { $sum: { $multiply: ['$orders.price', '$orders.qty'] } },
    units: { $sum: '$orders.qty' },
    buyers: { $addToSet: '$name' },
    lastOrder: { $max: '$orders.placedAt' },
  })
  .addFields({
    label: { $concat: ['sku:', '$_id'] },
    avgPrice: { $divide: ['$revenue', '$units'] },
  })
  .sort({ revenue: -1 });

type RevenueRow = InferResult<typeof revenueBySku>;
//   ^? { _id: string; revenue: number; units: number; buyers: string[]; lastOrder: Date; label: string; avgPrice: number }

/** Users with a computed summary, projected down. */
const userSummary = aggregate(User)
  .addFields({
    nOrders: { $size: '$orders' },
    isAdult: { $gte: ['$age', 18] },
    ageOrUnknown: { $ifNull: ['$age', 'unknown'] },
    tier: { $cond: [{ $gte: [{ $size: '$orders' }, 2] }, 'gold', 'basic'] },
  })
  .project({ name: 1, nOrders: 1, isAdult: 1, ageOrUnknown: 1, tier: 1, city: '$address.city', _id: 0 })
  .sort({ nOrders: -1 });

type UserSummaryRow = InferResult<typeof userSummary>;
//   ^? { name: string; nOrders: number; isAdult: boolean; ageOrUnknown: number | string; tier: string; city: string | null | undefined }
//      (`city` is nullable because Mongoose infers nested objects like `address` as optional unless they're `required`)

/** Preserve users with no orders, and keep the array index. */
const withEmpty = aggregate(User)
  .unwind({ path: '$orders', preserveNullAndEmptyArrays: true, includeArrayIndex: 'orderIdx' })
  .project({ name: 1, orderIdx: 1, sku: '$orders.sku', _id: 0 });

type WithEmptyRow = InferResult<typeof withEmpty>;
//   ^? { name: string; orderIdx: number | null; sku: string | null }

/** Join invoices (equality form) and summarise paid ones (typed sub-pipeline form). */
const withInvoices = aggregate(User)
  .lookup({ from: Invoice, localField: 'email', foreignField: 'userEmail', as: 'invoices' })
  .lookup({
    from: Invoice,
    let: { email: '$email' },
    pipeline: (inv) =>
      inv
        .match({ $expr: { $eq: ['$userEmail', '$$email'] }, paid: true })
        .group({ _id: null, total: { $sum: '$amount' }, n: { $count: {} } })
        .project({ _id: 0, total: 1, n: 1 }),
    as: 'paid',
  })
  .addFields({ paidTotal: { $ifNull: [{ $arrayElemAt: ['$paid.total', 0] }, 0] } })
  .project({ name: 1, _id: 0, 'invoices.number': 1, 'invoices.amount': 1, paidTotal: 1 });

type WithInvoicesRow = InferResult<typeof withInvoices>;
//   ^? { name: string; invoices: { number: string; amount: number }[]; paidTotal: number }

/** Promote the address to the root, conditionally filter. */
const onlyIsraeli = process.env['ONLY_IL'] === '1';
const addresses = aggregate(User)
  .when(onlyIsraeli, (p) => p.match({ 'address.country': 'IL' }))
  .replaceWith({ $mergeObjects: ['$address', { who: '$name' }] });

type AddressRow = InferResult<typeof addresses>;
//   ^? { city: string; country: string; zip?: string | null; who: string }

/** Just a count. */
const activeCount = aggregate(User).match({ active: true }).count('active');
//    ^? Pipeline<{ active: number }>

// ─────────────────────── 2. Things that should NOT compile ───────────────────
// Uncomment any line to see the compiler catch it.

// aggregate(User).sort({ nope: 1 });                       // unknown field
// aggregate(User).unwind('$name');                         // not an array
// revenueBySku.sort({ name: 1 });                          // `name` no longer exists after $group
// aggregate(User).group({ _id: '$nope', n: { $sum: 1 } })  // _id becomes TypeError<"Unknown field path: nope">
//   .exec().then(rows => rows[0]!._id.__typeError);

// ───────────────────────────── 3. Run for real ────────────────────────────────

async function main() {
  const uri = process.env['MONGO_URI'] ?? 'mongodb://127.0.0.1:27017/typed-agg-sandbox';
  console.log(`connecting to ${uri} …`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });

  await User.deleteMany({});
  await User.insertMany(seed);
  await Invoice.deleteMany({});
  await Invoice.insertMany(invoiceSeed);

  const show = (title: string, stages: unknown, rows: unknown) => {
    console.log(`\n=== ${title} ===`);
    console.log('pipeline:', JSON.stringify(stages));
    console.dir(rows, { depth: null });
  };

  const r1: RevenueRow[] = await revenueBySku.exec();
  show('revenueBySku', revenueBySku.build(), r1);

  const r2: UserSummaryRow[] = await userSummary.exec();
  show('userSummary', userSummary.build(), r2);

  const r3: WithEmptyRow[] = await withEmpty.exec();
  show('withEmpty', withEmpty.build(), r3);

  const r4: WithInvoicesRow[] = await withInvoices.exec();
  show('withInvoices', withInvoices.build(), r4);

  const r5: AddressRow[] = await addresses.exec();
  show('addresses', addresses.build(), r5);

  show('activeCount', activeCount.build(), await activeCount.exec());

  await mongoose.disconnect();
}

// Only run when executed directly (so `tsc` on this file never needs a DB).
if (process.argv[1] && /playground\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    console.error('\nNo MongoDB reachable. Start one (e.g. `brew services start mongodb-community`) or set MONGO_URI.');
    process.exit(1);
  });
}
