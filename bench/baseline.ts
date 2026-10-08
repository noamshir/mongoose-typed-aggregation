// Baseline: just Mongoose model inference, no pipeline. Compare against pipeline.ts.
import type { DocOf } from '../src/index.js';
import { Invoice, User } from '../test/fixtures.js';
export type A = DocOf<typeof User>;
export type B = DocOf<typeof Invoice>;
