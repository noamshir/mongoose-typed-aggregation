# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-10-08

Initial release.

### Added
- `aggregate(Model)` entry point and immutable `Pipeline<T>` builder; `InferResult<typeof pipeline>` helper.
- Shape-preserving stages: `match`, `sort`, `skip`, `limit`, `when`, `pipe`.
- Reshaping stages: `unwind` (string and options form), `group`, `addFields` / `set`, `project`, `unset`, `count`, `replaceRoot` / `replaceWith`.
- Joins: `lookup` in equality form and typed sub-pipeline form, with a Mongoose `Model` as `from`.
- Expression typing (`EvalExpr`) for field references, literals, system variables, and ~80 operators; unmodelled operators evaluate to `unknown`.
- Accumulators: `$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`, `$count`.
- Dotted keys in `addFields`, `project` and `unset`, mapped through arrays of subdocuments.
- `raw<R>()` escape hatch.
- Readable `TypeError<"Unknown field path: …">` results instead of silent `any`.
