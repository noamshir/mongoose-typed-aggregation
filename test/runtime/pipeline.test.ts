import { describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import { aggregate, Pipeline } from '../../src/index.js';

/** A fake model that records what `aggregate()` was called with. */
function fakeModel(result: unknown[] = []) {
  const exec = vi.fn(async () => result);
  const option = vi.fn();
  const aggregateFn = vi.fn(() => ({ exec, option }));
  const model = { aggregate: aggregateFn } as unknown as Model<any>;
  return { model, aggregateFn, exec, option };
}

describe('Pipeline (phase 1)', () => {
  it('builds stages in order', () => {
    const { model } = fakeModel();
    const stages = aggregate(model)
      .match({ active: true })
      .sort({ name: 1 } as any)
      .skip(2)
      .limit(3)
      .build();

    expect(stages).toEqual([
      { $match: { active: true } },
      { $sort: { name: 1 } },
      { $skip: 2 },
      { $limit: 3 },
    ]);
  });

  it('is immutable: each stage returns a new pipeline', () => {
    const { model } = fakeModel();
    const base = new Pipeline<{ a: number }>(model);
    const withMatch = base.match({ a: 1 });
    expect(base.build()).toEqual([]);
    expect(withMatch.build()).toEqual([{ $match: { a: 1 } }]);
    expect(withMatch).not.toBe(base);
  });

  it('build() returns a fresh array each time', () => {
    const { model } = fakeModel();
    const p = new Pipeline<{ a: number }>(model).limit(1);
    const a = p.build();
    const b = p.build();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('raw() appends an arbitrary stage', () => {
    const { model } = fakeModel();
    const stages = new Pipeline<{ a: number }>(model).raw<{ n: number }>({ $count: 'n' }).build();
    expect(stages).toEqual([{ $count: 'n' }]);
  });

  it('exec() passes the stages to model.aggregate and returns its result', async () => {
    const { model, aggregateFn, exec, option } = fakeModel([{ a: 1 }]);
    const result = await new Pipeline<{ a: number }>(model).match({ a: 1 }).exec({ allowDiskUse: true });

    expect(aggregateFn).toHaveBeenCalledWith([{ $match: { a: 1 } }]);
    expect(option).toHaveBeenCalledWith({ allowDiskUse: true });
    expect(exec).toHaveBeenCalledOnce();
    expect(result).toEqual([{ a: 1 }]);
  });
});
