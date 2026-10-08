# mongoose-typed-aggregation — Implementation Plan

A fluent, fully type-inferred aggregation pipeline builder for Mongoose.
Each stage method takes the current document shape `T` and returns
`Pipeline<NewShape>`, so the compiler infers the result type of:

```ts
const rows = await aggregate(UserModel)
  .match({ status: 'active' })
  .unwind('$orders')
  .group({ _id: '$orders.category', total: { $sum: '$orders.price' } })
  .addFields({ label: { $concat: ['cat:', '$_id'] } })
  .sort({ total: -1 })
  .exec();
// rows: { _id: string; total: number; label: string }[]
```

Runtime cost: zero. The builder only collects plain stage objects and calls
`Model.aggregate(stages)`. All the work happens in the type system.

---

## 0. Constraints and decisions

| Decision | Choice | Why |
|---|---|---|
| TypeScript | `^7.0.2` (native/Go compiler) | Target. TS 7 has no stable programmatic API yet, so no tools that import `typescript` as a library (`tsd`, `rollup-plugin-dts`, `tsup --dts`). |
| Build | plain `tsc` (two configs: ESM + CJS) | Works with TS 7 today, no API dependency. |
| Runtime tests | `vitest` + `mongodb-memory-server` | Real MongoDB behaviour for nullability edge cases. |
| Type tests | `expect-type` + `tsc --noEmit` on `test/types/**` | Pure-type library, runs on any TS. `// @ts-expect-error` for negative cases. |
| Module format | ESM first, CJS build emitted too | Mongoose 9 is ESM-friendly; CJS keeps older apps working. |
| Peer deps | `mongoose >= 9` | Uses `Model`, `QueryFilter` (renamed from `FilterQuery` in v9), `PipelineStage`, `InferSchemaType`. |
| Node | `>= 20` | |
| Package name | `mongoose-typed-aggregation` (free on npm) | |

tsconfig notes for TS 7: `strict` is default-on, `module` defaults to `esnext`,
`moduleResolution` must be `nodenext` or `bundler` (`node`/`node10` removed),
`baseUrl` removed, `types` defaults to `[]`, `rootDir` defaults to `./`.

---

## 1. Package layout

```
mongoose-typed-aggregation/
├── src/
│   ├── index.ts              # public API: aggregate(), Pipeline, types
│   ├── pipeline.ts           # Pipeline<T> class (runtime + method signatures)
│   ├── types/
│   │   ├── paths.ts          # Path<T>, PathValue<T,P>, ArrayPath<T>, FieldRef<T>
│   │   ├── leaf.ts           # Leaf types: ObjectId, Date, Buffer, Decimal128… (do not recurse)
│   │   ├── expressions.ts    # Expression<T> input type + EvalExpr<T, E> result type
│   │   ├── accumulators.ts   # Accumulator<T> + AccResult<T, A> for $group
│   │   └── stages/
│   │       ├── match.ts      # FilterQuery<T> → T
│   │       ├── sort.ts       # SortSpec<T>   → T
│   │       ├── unwind.ts     # Unwind<T, P>
│   │       ├── group.ts      # GroupResult<T, S>
│   │       ├── project.ts    # ProjectResult<T, S> (inclusion / exclusion / computed)
│   │       ├── addFields.ts  # T & { [K]: EvalExpr<T, S[K]> }
│   │       └── lookup.ts     # Lookup<T, U, As>
│   └── mongoose.ts           # DocOf<Model> = InferSchemaType + _id, lean-ified
├── test/
│   ├── types/                # *.test-d.ts — compiled with tsc --noEmit, expect-type
│   └── runtime/              # *.test.ts   — vitest + mongodb-memory-server
├── sandbox/                  # playground.ts (hover types / run on real Mongo) + expectations.ts
├── bench/                    # tsc --extendedDiagnostics on a realistic schema
├── PLAN.md
├── package.json
├── tsconfig.json             # base (src)
├── tsconfig.esm.json / tsconfig.cjs.json / tsconfig.test.json
└── vitest.config.ts
```

---

## 2. Phases

### Phase 1 — Foundation ✅
Goal: `aggregate(Model).match().sort().skip().limit().exec()` fully typed.

- [x] `types/leaf.ts` — `Leaf = ObjectId | Date | Buffer | Decimal128 | Map | RegExp | primitives`. Paths never recurse into these.
- [x] `types/paths.ts`
  - `Path<T, Depth=5>` — dotted paths via template literal types, depth-limited.
  - `PathValue<T, P>` — resolve a dotted path; arrays map through (`a.b` on `a: X[]` gives `B[]`).
  - `PathType<T, P>` — the *declared* type at a path (steps into arrays instead of mapping). Used by `ArrayPath`/`$unwind`.
  - `ArrayPath<T>` — paths whose value is an array (for `$unwind`).
  - `FieldRef<T>` = `` `$${Path<T>}` ``.
- [x] `pipeline.ts` — `Pipeline<T>` with immutable `stages: PipelineStage[]`, `match`, `sort`, `skip`, `limit`, `raw<R>()`, `build()`, `exec()`.
- [x] `mongoose.ts` — `DocOf<M>`: lean document type from a Model (`InferSchemaType` + `_id: ObjectId`, strip Document methods).
- [x] `index.ts` — `aggregate(model)` factory.
- [x] Type tests: match keeps T; sort keys restricted to `Path<T>`; `raw<R>` changes T; `exec()` returns `Promise<T[]>`.
- [x] Runtime test: pipeline stages array equals the expected plain objects.

### Phase 2 — Reshaping stages ✅
Goal: `.unwind().group().addFields().project()`.

- [x] `unwind(path)` — `Omit<T,P> & { [P]: Elem }`. Support `{ path, preserveNullAndEmptyArrays }` → `Elem | null`.
- [x] `expressions.ts` — minimal expression language:
  - field refs `$a.b` → `PathValue`
  - literals (string/number/boolean/null) → themselves
  - `$concat`, `$toUpper`/`$toLower` → `string`
  - `$add`, `$subtract`, `$multiply`, `$divide`, `$size` → `number`
  - `$ifNull: [E, D]` → `NonNullable<Eval<E>> | Eval<D>`
  - `$cond: [c, a, b]` / `{ if, then, else }` → `Eval<a> | Eval<b>`
  - `$arrayElemAt: [arr, n]` → `Elem | null`
  - anything else → `unknown`
- [x] `accumulators.ts` — `$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`, `$count`.
  - `$first/$last/$min/$max` follow the schema: required field → value, optional field → `value | null` (`undefined` becomes `null`, as Mongo returns).
- [x] `group(spec)` — `_id` can be a field ref, an expression, an object of refs, or `null`.
- [x] `addFields(spec)` / `set(spec)` — `T & { [K]: Eval<S[K]> }` (overrides existing keys).
- [x] `project(spec)` — three modes detected from the spec:
  - inclusion (`1`/`true` values, optional `_id: 0`) → `Pick`
  - exclusion (`0`/`false` only) → `Omit`
  - computed (expression values) → `Pick<included> & { computed }`
- [x] North-star type test: `.match().group().addFields().sort()` infers exactly.

### Phase 3 — Joins and escape hatches ✅
- [x] `lookup({ from: Model<U>, localField, foreignField, as })` → `T & { [as]: U[] }` (Model, not string, is what makes this typeable).
- [x] `lookup({ from, let, pipeline: p => …, as })` — the sub-pipeline is a typed `Pipeline<DocOf<U>>`; `as` gets its output type.
- [x] `unset(...paths)`, `replaceWith(expr)`, `$mergeObjects` (2–3 args), `pipe(fragment)` for reusable fragments.
- [x] Dotted keys in `addFields`/`set`/`project`/`unset` (`'address.city': …`, mapped through arrays of subdocuments).
- [x] `lookup` + `unwind('$as')` → `U` (and `U | null` with preserveNullAndEmptyArrays).
- [x] `count(field)` → `{ [field]: number }`.
- [x] `replaceRoot('$path')` → `PathValue`.
- [x] `when(cond, p => p...)` — conditional stage; result type is `T | T2`-safe (keeps `T` when the branch doesn't reshape, otherwise union).
- [x] `raw<R>(stage)` documented as the explicit escape hatch.

### Phase 4 — Hardening and publish
- [x] `bench/` — 10-stage pipeline with a join vs. a Mongoose-only baseline (`npm run bench`).
  First measurement (TS 7.0.2, Mongoose 9.11): baseline 1,480k instantiations / 0.68s; with pipeline 1,498k / 0.68s → the pipeline costs ~18k instantiations (~1%). Mongoose's own types dominate.
- [ ] Turn the bench into a CI budget (fail if pipeline delta > 100k instantiations).
- [ ] Error messages: branded `never` types with hints, e.g. `{ __error: "unknown field 'foo' on T" }`.
- [ ] `lean` behaviour docs: aggregation returns plain objects, no getters/virtuals.
- [ ] README with the goal example, supported operators table, and "what's `unknown` and why".
- [ ] CI: typecheck + tests + bench on TS 7.0 and TS `next`.
- [ ] Publish `0.1.0`.

### Later (not in MVP)
`$facet`, `$bucket`, `$bucketAuto`, `$graphLookup`, `$unionWith`, `$merge`/`$out`,
`$setWindowFields`, `$densify`, full expression operator coverage, `$lookup` with sub-pipeline.

---

## 3. Type-system rules we commit to

1. **Nullability follows the schema.** The starting shape already trusts the schema (required means present), so stages do too; optional fields stay optional/nullable through every stage, and `undefined` becomes `null` where Mongo would return `null` (accumulators). Operators that can produce `null` on their own (`$arrayElemAt`, `$avg`, `$unwind` with `preserveNullAndEmptyArrays`) are typed `| null`.
2. **Unknown over wrong.** An operator we don't model types as `unknown`, not `any`, so the user is forced to narrow or use `raw<R>()`.
3. **One stage at a time.** Never infer from a whole pipeline tuple; each method computes one transform. This is what keeps TS 7 fast.
4. **Depth limit 5** on path recursion. Leaf types never recurse.
5. **Models, not strings,** for cross-collection references.
6. **Immutable builder.** Each method returns a new `Pipeline`; the old one is unchanged.

---

## 4. Testing strategy

- `npm run typecheck` — `tsc --noEmit -p tsconfig.test.json` compiles `test/types/**/*.test-d.ts`.
  Positive assertions via `expectTypeOf(...).toEqualTypeOf<...>()`; negatives via `// @ts-expect-error`.
- `npm test` — vitest runtime suite against `mongodb-memory-server`, asserting both the generated stage objects and real results.
- `npm run bench` — compile-time budget on the bench schema.
- The type tests are the primary test suite for this package.

---

## 5. Public API (target)

```ts
import { aggregate } from 'mongoose-typed-aggregation';

aggregate(Model)                 // Pipeline<DocOf<typeof Model>>
  .match(filter)                 // Pipeline<T>
  .sort({ field: 1 | -1 })       // Pipeline<T>
  .skip(n).limit(n)              // Pipeline<T>
  .unwind('$arr' | { path, preserveNullAndEmptyArrays })
  .group({ _id, ...accumulators })
  .addFields({ k: expr })  /  .set({ k: expr })
  .project({ k: 1 | 0 | expr })
  .lookup({ from: Model, localField, foreignField, as })
  .count('field')
  .replaceRoot('$path')
  .when(cond, p => p.match(...))
  .raw<R>(stage)                 // escape hatch
  .build()                       // PipelineStage[]
  .exec()                        // Promise<T[]>
```
