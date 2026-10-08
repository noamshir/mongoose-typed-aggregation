/**
 * The goal of this package, kept here from day one so every phase is
 * measured against it.
 */
import { expectTypeOf } from 'expect-type';
import { aggregate } from '../../src/index.js';
import { User } from '../fixtures.js';

const rows = aggregate(User)
  .match({ active: true })
  .unwind('$orders')
  .group({
    _id: '$orders.sku',
    total: { $sum: '$orders.price' },
    buyers: { $addToSet: '$name' },
  })
  .addFields({ label: { $concat: ['sku:', '$_id'] } })
  .sort({ total: -1 })
  .limit(10)
  .exec();

expectTypeOf(rows).resolves.toEqualTypeOf<
  { _id: string; total: number; buyers: string[]; label: string }[]
>();
