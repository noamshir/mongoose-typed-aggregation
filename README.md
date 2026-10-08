# mongoose-typed-aggregation

**Fluent, fully type-inferred aggregation pipelines for Mongoose.**
The compiler infers the output type of `.match().unwind().group().addFields().sort()` — stage by stage, with zero runtime cost.

[![npm](https://img.shields.io/npm/v/mongoose-typed-aggregation.svg)](https://www.npmjs.com/package/mongoose-typed-aggregation)
[![CI](https://github.com/noamshir/mongoose-typed-aggregation/actions/workflows/ci.yml/badge.svg)](https://github.com/noamshir/mongoose-typed-aggregation/actions/workflows/ci.yml)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-%E2%89%A57-3178c6.svg)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/mongoose-typed-aggregation.svg)](./LICENSE)

```ts
import { aggregate } from 'mongoose-typed-aggregation';

const rows = await aggregate(User)
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

rows;
// ^? { _id: string; total: number; buyers: string[]; label: string }[]
```

No generics to write by hand. No `as` casts. If you misspell a field, reference a field that a previous `$group` removed, or `$unwind` something that isn't an array, it doesn't compile.

## Why

`Model.aggregate()` returns `any[]` (or whatever you assert), because the shape of an aggregation result is decided by the pipeline, not the schema. Mongoose can't know it.

But *we* know what every stage does. This library models each stage as a type-level function from the input document shape to the output shape, and chains them through a fluent builder. TypeScript only ever evaluates **one stage at a time**, so inference stays fast and the pipeline can be as long as you like.

## Install

```sh
npm install mongoose-typed-aggregation
```

Requirements: **TypeScript ≥ 7**, **Mongoose ≥ 9**, Node ≥ 20. The package is ESM; Node 20.19+/22.12+ can `require()` it as well.

## Quick start

```ts
import { Schema, model } from 'mongoose';
import { aggregate, type InferResult } from 'mongoose-typed-aggregation';

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: Number,
  active: { type: Boolean, required: true },
  address: { city: { type: String, required: true }, zip: String },
  orders: [{ sku: { type: String, required: true }, price: { type: Number, required: true } }],
});
const User = model('User', userSchema);

const pipeline = aggregate(User)
  .match({ active: true })
  .addFields({ nOrders: { $size: '$orders' } })
  .project({ name: 1, nOrders: 1, city: '$address.city', _id: 0 })
  .sort({ nOrders: -1 });

type Row = InferResult<typeof pipeline>;
// { name: string; nOrders: number; city: string | null | undefined }
//                                    ^ Mongoose infers nested objects as optional unless `required`

const rows: Row[] = await pipeline.exec();
const stages = pipeline.build(); // plain PipelineStage[] — pass it anywhere
```

## Stages

Every method returns a **new** `Pipeline` (the receiver is never mutated), typed with the shape after that stage.

| Method | MongoDB stage | Effect on the document type |
|---|---|---|
| `match(filter)` | `$match` | unchanged (`filter` is Mongoose's `QueryFilter<T>`) |
| `sort({ path: 1 \| -1 })` | `$sort` | unchanged; keys must be real paths |
| `skip(n)` / `limit(n)` | `$skip` / `$limit` | unchanged |
| `unwind('$path')` | `$unwind` | array field becomes its element type |
| `unwind({ path, preserveNullAndEmptyArrays, includeArrayIndex })` | `$unwind` | element `\| null` when preserving; index field added |
| `group({ _id, ...accumulators })` | `$group` | replaced by `{ _id: Eval<_id>; [k]: AccResult }` |
| `addFields(spec)` / `set(spec)` | `$addFields` / `$set` | fields added or overridden; dotted keys merge into nested objects |
| `project(spec)` | `$project` | inclusion → pick (+`_id` unless `_id: 0`); exclusion → omit; computed → evaluated; dotted keys supported |
| `unset(...paths)` | `$unset` | paths removed (dotted supported) |
| `count('field')` | `$count` | `{ field: number }` |
| `replaceRoot(expr)` / `replaceWith(expr)` | `$replaceRoot` / `$replaceWith` | the evaluated expression (non-null) |
| `lookup({ from: Model, localField, foreignField, as })` | `$lookup` | `as: DocOf<Model>[]` |
| `lookup({ from: Model, let, pipeline: p => …, as })` | `$lookup` | `as: <sub-pipeline output>[]`; the callback is typed against `from` |
| `when(cond, p => …)` | — | branch applied only if `cond`; type is `T \| R` (just `T` when the branch only filters/sorts) |
| `pipe(fragment)` | — | apply a reusable `(p: Pipeline<T>) => Pipeline<R>` |
| `raw<R>(stage)` | any | **you** declare the resulting shape (escape hatch) |
| `build()` | — | returns `PipelineStage[]` |
| `exec(options?)` | — | runs `Model.aggregate()` → `Promise<T[]>` |

### Joins

`from` takes a **Model**, not a collection name. That's what makes the joined shape known.

```ts
const rows = await aggregate(User)
  .lookup({ from: Invoice, localField: '_id', foreignField: 'userId', as: 'invoices' })
  .lookup({
    from: Invoice,
    let: { uid: '$_id' },
    pipeline: (inv) => inv                                  // Pipeline<InvoiceDoc>
      .match({ $expr: { $eq: ['$userId', '$$uid'] }, paid: true })
      .group({ _id: null, total: { $sum: '$amount' } }),
    as: 'paid',
  })
  .unwind({ path: '$paid', preserveNullAndEmptyArrays: true })
  .exec();

rows[0].invoices; // InvoiceDoc[]
rows[0].paid;     // { _id: null; total: number } | null
```

Both `localField` and `foreignField` are checked against the right side: `foreignField: 'name'` is a compile error if `Invoice` has no `name`.

### Dotted keys

```ts
aggregate(User)
  .addFields({ 'address.country': 'IL', 'orders.discounted': { $lt: ['$orders.price', 50] } })
  // address: { city; zip?; country: string }, orders: { sku; price; discounted: boolean }[]
  .project({ name: 1, 'address.city': 1 })
  // { _id; name: string; address: { city: string } }
```

Assignments through an array of subdocuments apply to every element, as MongoDB does.

### Conditional and reusable stages

```ts
const onlyAdults = (p: Pipeline<UserDoc>) => p.match({ age: { $gte: 18 } });

aggregate(User)
  .when(req.query.adults === '1', onlyAdults)   // Pipeline<UserDoc> — same shape either way
  .pipe(withOrderStats)                          // any (p: Pipeline<UserDoc>) => Pipeline<R>
  .exec();
```

## Expressions

Anywhere an expression is accepted (`addFields`, `project`, `group`, `replaceRoot`, `lookup.let`), the result type is computed by `EvalExpr<T, E>`:

| Expression | Result type |
|---|---|
| `'$path'`, `'$a.b.c'` | the field's type; through an array it's mapped (`'$orders.price'` → `number[]`); optional parents propagate `undefined`/`null` |
| `'$$ROOT'` / `'$$CURRENT'`, `'$$NOW'` | `T`, `Date` |
| `'$$var'` (from `let`) | `unknown` |
| string / number / boolean / `null` / `Date` literals | themselves |
| `{ $literal: x }` | the literal type of `x` |
| `{ $ifNull: [a, b] }` | `NonNullable<Eval<a>> \| Eval<b>` |
| `{ $cond: [c, a, b] }` / `{ $cond: { if, then, else } }` | `Eval<a> \| Eval<b>` |
| `{ $arrayElemAt: [arr, i] }`, `{ $first: arr }`, `{ $last: arr }` | element `\| null` |
| `{ $mergeObjects: [a, b, c?] }` | right-biased merge of the object types |
| `{ $filter }`, `{ $slice }`, `{ $reverseArray }`, `{ $concatArrays }` | the input array type |
| `{ $split }` | `string[]` |
| `{ $objectToArray }` | `{ k: string; v: unknown }[]` |
| `{ $toObjectId }`, `{ $toDate }`, `{ $dateAdd }`, `{ $dateSubtract }` | `ObjectId`, `Date` |
| **string ops** `$concat $toUpper $toLower $toString $substr $substrCP $substrBytes $trim $ltrim $rtrim $dateToString $replaceAll $replaceOne` | `string` |
| **number ops** `$add $subtract $multiply $divide $mod $abs $ceil $floor $round $trunc $sqrt $pow $exp $ln $log10 $size $strLenCP $strLenBytes $indexOfArray $indexOfCP $toInt $toDouble $toLong $toDecimal $year $month $dayOfMonth $hour $minute $second $millisecond $dayOfWeek $dayOfYear $week $isoWeek $isoWeekYear $isoDayOfWeek $dateDiff` | `number` |
| **boolean ops** `$eq $ne $gt $gte $lt $lte $in $and $or $not $toBool $isArray $isNumber $regexMatch $allElementsTrue $anyElementTrue` | `boolean` |
| `[e1, e2]` / `{ a: e1, b: e2 }` | element-wise evaluated array / object |
| any other `$operator` | `unknown` — never `any` |
| `'$nope'` (unknown path) | `TypeError<"Unknown field path: nope">` |

### Accumulators (`$group`)

| Accumulator | Result |
|---|---|
| `$sum`, `$count` | `number` |
| `$avg` | `number \| null` |
| `$min`, `$max`, `$first`, `$last` | the expression's type, with `undefined` → `null` |
| `$push`, `$addToSet` | `Exclude<type, undefined>[]` |

## Type-level rules

1. **Nullability follows the schema.** The starting shape trusts the schema (a `required` field is present). Optional fields stay optional through every stage, `undefined` becomes `null` where MongoDB would return `null`, and operators that can produce `null` on their own (`$arrayElemAt`, `$avg`, preserving `$unwind`) are typed `| null`.
2. **`unknown` over wrong.** An operator the library doesn't model evaluates to `unknown`, so you must narrow or use `raw<R>()`. Nothing silently becomes `any`.
3. **One stage at a time.** Nothing is inferred from a whole pipeline tuple. A 10-stage pipeline with a join adds ~1 % to the type instantiations Mongoose's own model types already cost (`npm run bench`).
4. **Models, not strings**, for anything that crosses collections.
5. **Immutable builder.** Every method returns a new `Pipeline`; fragments can be shared safely.

## Escape hatch

```ts
aggregate(User)
  .raw<{ bucket: number; n: number }>({ $bucketAuto: { groupBy: '$age', buckets: 5, output: { n: { $sum: 1 } } } })
  .sort({ n: -1 }); // typed against the shape you declared
```

`raw` is an assertion, not a check — keep those pipelines small and close to their tests.

## Starting from an explicit shape

If you'd rather not derive the document type from the Model (discriminators, `Mixed`, a lean type you already have):

```ts
import { Pipeline } from 'mongoose-typed-aggregation';

new Pipeline<MyLeanDoc>(User).match({ … });
```

`DocOf<typeof Model>` is exported too, if you want to reuse the derived shape elsewhere.

## Not supported (yet)

- `$facet`, `$bucket`, `$bucketAuto`, `$graphLookup`, `$unionWith`, `$merge`, `$out`, `$setWindowFields`, `$densify` — use `raw<R>()`.
- Numeric array index paths (`'orders.0.sku'`).
- `$lookup` with a collection-name string (pass the Model).
- Array/object operators beyond the table above evaluate to `unknown`.

See [PLAN.md](./PLAN.md) for the roadmap.

## Development

```sh
npm run typecheck    # type tests in test/types/*.test-d.ts — the primary test suite
npm test             # runtime tests (vitest)
npm run check        # both
npm run build        # emit dist/ with tsc
npm run sandbox      # type-check sandbox/playground.ts — open it and hover the ^? lines
npm run sandbox:run  # run the playground against MongoDB (MONGO_URI, default local)
npm run bench        # compile-time cost vs. a Mongoose-only baseline
```

Type tests use [`expect-type`](https://github.com/mmkal/expect-type) and plain `tsc --noEmit`; negative cases are `// @ts-expect-error` lines. TypeScript 7's native compiler has no stable programmatic API yet, which is why the build is plain `tsc` rather than a bundler.

## Contributing

Issues and PRs are welcome. For a new operator or stage, add its type in `src/types/`, a positive and a negative case in `test/types/`, and — if it emits a stage — a runtime case in `test/runtime/`. Run `npm run bench` and mention the delta in the PR.

## License

[MIT](./LICENSE) © Noam Shir
