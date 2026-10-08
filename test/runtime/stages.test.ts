import { describe, expect, it } from 'vitest';
import type { Model } from 'mongoose';
import { Pipeline } from '../../src/index.js';

const model = { aggregate: () => ({ exec: async () => [] }) } as unknown as Model<any>;
type Doc = { _id: string; name: string; orders: { sku: string; price: number }[] };

describe('Pipeline (phase 2) emits the right stage objects', () => {
  it('unwind: string and options forms', () => {
    expect(new Pipeline<Doc>(model).unwind('$orders').build()).toEqual([{ $unwind: '$orders' }]);
    expect(
      new Pipeline<Doc>(model)
        .unwind({ path: '$orders', preserveNullAndEmptyArrays: true, includeArrayIndex: 'i' })
        .build(),
    ).toEqual([{ $unwind: { path: '$orders', preserveNullAndEmptyArrays: true, includeArrayIndex: 'i' } }]);
  });

  it('group / addFields / set / project / count', () => {
    const stages = new Pipeline<Doc>(model)
      .unwind('$orders')
      .group({ _id: '$orders.sku', total: { $sum: '$orders.price' } })
      .addFields({ label: { $concat: ['sku:', '$_id'] } })
      .set({ double: { $multiply: ['$total', 2] } })
      .project({ label: 1, double: 1, _id: 0 })
      .count('n')
      .build();

    expect(stages).toEqual([
      { $unwind: '$orders' },
      { $group: { _id: '$orders.sku', total: { $sum: '$orders.price' } } },
      { $addFields: { label: { $concat: ['sku:', '$_id'] } } },
      { $set: { double: { $multiply: ['$total', 2] } } },
      { $project: { label: 1, double: 1, _id: 0 } },
      { $count: 'n' },
    ]);
  });
});
