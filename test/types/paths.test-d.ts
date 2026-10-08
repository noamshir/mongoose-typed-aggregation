import { expectTypeOf } from 'expect-type';
import type { Types } from 'mongoose';
import type { ArrayPath, FieldRef, Path, PathType, PathValue } from '../../src/index.js';

type Doc = {
  _id: Types.ObjectId;
  name: string;
  age?: number;
  address: { city: string; zip?: string };
  orders: { sku: string; price: number; tags: string[] }[];
  createdAt: Date;
  meta?: { views: number } | null;
};

// ── Path ────────────────────────────────────────────────────────────────────
expectTypeOf<Path<Doc>>().toEqualTypeOf<
  | '_id'
  | 'name'
  | 'age'
  | 'address'
  | 'address.city'
  | 'address.zip'
  | 'orders'
  | 'orders.sku'
  | 'orders.price'
  | 'orders.tags'
  | 'createdAt'
  | 'meta'
  | 'meta.views'
>();

// Leaf types do not expand into their internals.
expectTypeOf<Path<{ d: Date; id: Types.ObjectId; s: string }>>().toEqualTypeOf<'d' | 'id' | 's'>();

// Depth limit stops runaway recursion.
type Deep = { a: { b: { c: { d: { e: { f: { g: number } } } } } } };
expectTypeOf<Path<Deep, 2>>().toEqualTypeOf<'a' | 'a.b' | 'a.b.c'>();

// ── PathValue ───────────────────────────────────────────────────────────────
expectTypeOf<PathValue<Doc, 'name'>>().toEqualTypeOf<string>();
expectTypeOf<PathValue<Doc, 'age'>>().toEqualTypeOf<number | undefined>();
expectTypeOf<PathValue<Doc, 'address.city'>>().toEqualTypeOf<string>();
expectTypeOf<PathValue<Doc, 'address.zip'>>().toEqualTypeOf<string | undefined>();
// Through an array the value is mapped.
expectTypeOf<PathValue<Doc, 'orders.price'>>().toEqualTypeOf<number[]>();
expectTypeOf<PathValue<Doc, 'orders.tags'>>().toEqualTypeOf<string[][]>();
// Through an optional/nullable object the nullishness propagates.
expectTypeOf<PathValue<Doc, 'meta.views'>>().toEqualTypeOf<number | null | undefined>();
// Unknown path is never.
expectTypeOf<PathValue<Doc, 'nope'>>().toEqualTypeOf<never>();

// ── PathType (declared type, steps into arrays) ─────────────────────────────
expectTypeOf<PathType<Doc, 'orders.price'>>().toEqualTypeOf<number>();
expectTypeOf<PathType<Doc, 'orders.tags'>>().toEqualTypeOf<string[]>();
expectTypeOf<PathType<Doc, 'orders'>>().toEqualTypeOf<Doc['orders']>();
expectTypeOf<PathType<Doc, 'meta.views'>>().toEqualTypeOf<number | null | undefined>();

// ── ArrayPath / FieldRef ────────────────────────────────────────────────────
expectTypeOf<ArrayPath<Doc>>().toEqualTypeOf<'orders' | 'orders.tags'>();
expectTypeOf<FieldRef<{ a: string; b: { c: number } }>>().toEqualTypeOf<'$a' | '$b' | '$b.c'>();
