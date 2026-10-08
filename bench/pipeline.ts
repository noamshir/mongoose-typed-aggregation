// A realistic 10-stage pipeline. `npm run bench` prints instantiation counts and check time.
import { aggregate, type InferResult } from '../src/index.js';
import { Invoice, User } from '../test/fixtures.js';

export const p = aggregate(User)
  .match({ active: true, age: { $gte: 18 } })
  .unwind('$orders')
  .lookup({ from: Invoice, localField: '_id', foreignField: 'userId', as: 'invoices' })
  .addFields({ nInv: { $size: '$invoices' }, line: { $multiply: ['$orders.price', 2] } })
  .group({
    _id: { sku: '$orders.sku', city: '$address.city' },
    revenue: { $sum: '$line' },
    buyers: { $addToSet: '$name' },
    invoices: { $sum: '$nInv' },
    last: { $max: '$createdAt' },
  })
  .project({ sku: '$_id.sku', city: '$_id.city', revenue: 1, buyers: 1, invoices: 1, _id: 0 })
  .addFields({ label: { $concat: ['$sku', ' @ ', '$city'] } })
  .sort({ revenue: -1 })
  .skip(0)
  .limit(100);

export type Row = InferResult<typeof p>;
