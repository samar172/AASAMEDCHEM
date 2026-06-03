import {
  pgTable,
  pgEnum,
  text,
  uuid,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

/** Application roles for role-based access control. */
export const roleEnum = pgEnum("role", ["admin", "seller"]);

/**
 * Physical dimension of a product. Each dimension has exactly one canonical
 * base unit in which quantities are stored internally:
 *   weight -> gram (g), volume -> millilitre (mL), count -> item.
 */
export const dimensionEnum = pgEnum("dimension", ["weight", "volume", "count"]);

/** A single document that can be either a quotation request or a firm order. */
export const orderTypeEnum = pgEnum("order_type", ["quotation", "order"]);

/** Lifecycle of a quotation/order. */
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "quoted",
  "confirmed",
  "rejected",
  "fulfilled",
]);

/* ---------------------------------------------------------------------------
 * Numeric precision conventions (see README for rationale)
 *   - quantities & factors : NUMERIC(20, 6)  -> exact, high precision, large range
 *   - per-unit rates       : NUMERIC(20, 6)  -> per-base-unit rates can be tiny
 *   - money totals         : NUMERIC(20, 2)  -> INR rounded to paise
 * NUMERIC (not float8) is used everywhere money/quantity math happens so there
 * is no binary floating-point drift.
 * ------------------------------------------------------------------------- */

const QTY = { precision: 20, scale: 6 } as const;
const RATE = { precision: 20, scale: 6 } as const;
const MONEY = { precision: 20, scale: 2 } as const;

/* ---------------------------------------------------------------------------
 * Tables
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("seller"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

/**
 * Reference table of supported units. `factorToBase` converts a quantity
 * expressed in this unit into the dimension's base unit:
 *   base_qty = qty_in_unit * factor_to_base
 * e.g. kg -> 1000 (1 kg = 1000 g), L -> 1000 (1 L = 1000 mL).
 */
export const units = pgTable("units", {
  code: text("code").primaryKey(), // 'g', 'kg', 'mL', 'L', 'item'
  label: text("label").notNull(), // 'Grams', 'Kilograms', ...
  dimension: dimensionEnum("dimension").notNull(),
  factorToBase: numeric("factor_to_base", QTY).notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  dimension: dimensionEnum("dimension").notNull(),
  /** Canonical base unit for this product's dimension (g | mL | item). */
  baseUnit: text("base_unit")
    .notNull()
    .references(() => units.code),
  /** Price in INR per ONE base unit (e.g. INR per gram). */
  basePrice: numeric("base_price", RATE).notNull(),
  /** Current stock level, stored in base units. */
  stockBaseQty: numeric("stock_base_qty", QTY).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: orderTypeEnum("type").notNull().default("quotation"),
  status: orderStatusEnum("status").notNull().default("pending"),
  /** Snapshot of the grand total in INR at submission time. */
  total: numeric("total", MONEY).notNull().default("0"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  /** Quantity exactly as the user entered it, in `orderedUnit`. */
  orderedQty: numeric("ordered_qty", QTY).notNull(),
  orderedUnit: text("ordered_unit")
    .notNull()
    .references(() => units.code),
  /** orderedQty converted into the product's base unit. */
  baseQty: numeric("base_qty", QTY).notNull(),
  /** Snapshot of product.basePrice (INR per base unit) at order time. */
  unitPriceBase: numeric("unit_price_base", RATE).notNull(),
  /** Line total in INR = baseQty * unitPriceBase, rounded to paise. */
  lineTotal: numeric("line_total", MONEY).notNull(),
  // Convenience snapshot for display/history.
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
});

/* ---------------------------------------------------------------------------
 * Relations
 * ------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  baseUnitRef: one(units, {
    fields: [products.baseUnit],
    references: [units.code],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

/* ---------------------------------------------------------------------------
 * Inferred types
 * ------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
