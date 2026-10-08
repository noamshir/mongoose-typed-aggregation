import { Schema, model } from 'mongoose';

/** A sample schema to play with. Edit freely — the playground re-infers everything. */
export const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: Number,
  active: { type: Boolean, required: true, default: true },
  role: { type: String, enum: ['admin', 'member', 'guest'], required: true },
  address: {
    city: { type: String, required: true },
    country: { type: String, required: true },
    zip: String,
  },
  orders: [
    {
      sku: { type: String, required: true },
      price: { type: Number, required: true },
      qty: { type: Number, required: true, default: 1 },
      tags: [String],
      placedAt: { type: Date, required: true },
    },
  ],
  createdAt: { type: Date, required: true, default: Date.now },
});

export const User = model('SandboxUser', userSchema, 'sandbox_users');

export const invoiceSchema = new Schema({
  userEmail: { type: String, required: true },
  number: { type: String, required: true },
  amount: { type: Number, required: true },
  paid: { type: Boolean, required: true, default: false },
});
export const Invoice = model('SandboxInvoice', invoiceSchema, 'sandbox_invoices');

export const invoiceSeed = [
  { userEmail: 'ada@example.com', number: 'INV-1', amount: 165, paid: true },
  { userEmail: 'ada@example.com', number: 'INV-2', amount: 40, paid: false },
  { userEmail: 'ben@example.com', number: 'INV-3', amount: 120, paid: true },
];

export const seed = [
  {
    name: 'Ada', email: 'ada@example.com', age: 36, role: 'admin',
    address: { city: 'Tel Aviv', country: 'IL', zip: '61000' },
    orders: [
      { sku: 'KB-1', price: 120, qty: 1, tags: ['hardware'], placedAt: new Date('2026-01-10') },
      { sku: 'MS-2', price: 45, qty: 2, tags: ['hardware', 'sale'], placedAt: new Date('2026-02-03') },
    ],
  },
  {
    name: 'Ben', email: 'ben@example.com', age: 24, role: 'member',
    address: { city: 'Haifa', country: 'IL' },
    orders: [{ sku: 'KB-1', price: 120, qty: 1, tags: [], placedAt: new Date('2026-03-15') }],
  },
  {
    name: 'Cleo', email: 'cleo@example.com', role: 'guest', active: false,
    address: { city: 'Berlin', country: 'DE' },
    orders: [],
  },
];
