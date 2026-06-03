import { z } from "zod";
import { UNITS } from "./units";

const unitCodes = UNITS.map((u) => u.code) as [string, ...string[]];

/** A positive decimal supplied as a string (preserves precision over the wire). */
const decimalString = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) >= 0, {
    message: "Must be a non-negative number",
  });

const positiveDecimalString = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0, {
    message: "Must be a positive number",
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const productInputSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().uuid().nullable().optional(),
  dimension: z.enum(["weight", "volume", "count"]),
  /** Admin enters the price per this display unit + the unit itself. */
  pricePerDisplayUnit: positiveDecimalString,
  priceUnit: z.enum(unitCodes),
  /** Stock entered in stockUnit, converted to base on save. */
  stockQty: decimalString,
  stockUnit: z.enum(unitCodes),
  isActive: z.boolean().optional().default(true),
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  orderedQty: positiveDecimalString,
  orderedUnit: z.enum(unitCodes),
});

export const orderInputSchema = z.object({
  type: z.enum(["quotation", "order"]).default("quotation"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(orderItemInputSchema).min(1, "Add at least one product"),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "quoted", "confirmed", "rejected", "fulfilled"]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
