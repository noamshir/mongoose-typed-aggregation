import { describe, expect, it } from 'vitest';
import type { Model } from 'mongoose';
import { Pipeline } from '../../src/index.js';

const fake = (collection: string) =>
  ({ collection: { name: collection }, aggregate: () => ({ exec: async () => [] }) }) as unknown as Model<any>;
const users = fake('users');
const invoices = fake('invoices');
type Doc = { _id: string; name: string; address: { city: string }; orders: { sku: string }[] };
type Inv = { _id: string; userId: string; amount: number };

describe('Pipeline (phase 3)', () => {
  it('lookup equality form uses the model collection name', () => {
    const stages = new Pipeline<Doc>(users)
      .lookup({ from: invoices as Model<Inv>, localField: '_id', foreignField: 'userId', as: 'inv' })
      .build();
    expect(stages).toEqual([{ $lookup: { from: 'invoices', localField: '_id', foreignField: 'userId', as: 'inv' } }]);
  });

  it('lookup pipeline form builds the sub-pipeline against the foreign model', () => {
    const stages = new Pipeline<Doc>(users)
      .lookup({
        from: invoices as Model<Inv>,
        let: { uid: '$_id' },
        pipeline: (p) => p.match({ $expr: { $eq: ['$userId', '$$uid'] } }).group({ _id: null, total: { $sum: '$amount' } }),
        as: 'paid',
      })
      .build();
    expect(stages).toEqual([
      {
        $lookup: {
          from: 'invoices',
          let: { uid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$userId', '$$uid'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }],
          as: 'paid',
        },
      },
    ]);
  });

  it('replaceRoot / replaceWith / unset', () => {
    const stages = new Pipeline<Doc>(users)
      .unset('orders')
      .unset('name', 'address.city')
      .replaceRoot('$address')
      .replaceWith({ $mergeObjects: ['$$ROOT', { x: 1 }] })
      .build();
    expect(stages).toEqual([
      { $unset: 'orders' },
      { $unset: ['name', 'address.city'] },
      { $replaceRoot: { newRoot: '$address' } },
      { $replaceWith: { $mergeObjects: ['$$ROOT', { x: 1 }] } },
    ]);
  });

  it('when() applies the branch only when the condition holds; pipe() always', () => {
    const base = new Pipeline<Doc>(users).match({ name: 'a' });
    const onlySorted = (p: Pipeline<Doc>) => p.sort({ name: 1 });

    expect(base.when(false, onlySorted).build()).toEqual([{ $match: { name: 'a' } }]);
    expect(base.when(true, onlySorted).build()).toEqual([{ $match: { name: 'a' } }, { $sort: { name: 1 } }]);
    expect(base.pipe(onlySorted).build()).toEqual([{ $match: { name: 'a' } }, { $sort: { name: 1 } }]);
    // base itself is untouched
    expect(base.build()).toEqual([{ $match: { name: 'a' } }]);
  });
});
