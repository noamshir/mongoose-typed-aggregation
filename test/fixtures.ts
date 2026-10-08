import { Schema, model, type InferSchemaType } from 'mongoose';

export const userSchema = new Schema({
  name: { type: String, required: true },
  age: Number,
  active: { type: Boolean, required: true },
  address: {
    city: { type: String, required: true },
    zip: String,
  },
  orders: [
    {
      sku: { type: String, required: true },
      price: { type: Number, required: true },
      tags: [String],
    },
  ],
  createdAt: { type: Date, required: true },
});

export type UserRaw = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);

export const invoiceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  number: { type: String, required: true },
  amount: { type: Number, required: true },
  paid: { type: Boolean, required: true, default: false },
});
export const Invoice = model('Invoice', invoiceSchema);
