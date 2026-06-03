import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import {
  UNITS,
  BASE_UNIT,
  pricePerDisplayUnitToBase,
  calcLineTotal,
  unitsForDimension,
  type Dimension,
} from "../lib/units";
import { Decimal } from "decimal.js";

/**
 * Idempotent-ish seed: wipes domain tables and inserts a clean, realistic demo
 * dataset spread over the last ~90 days so analytics charts have real shape.
 *
 * Test credentials:
 *   admin@aasamed.com  / Admin@123   (role: admin)
 *   seller@aasamed.com / Seller@123  (role: seller — primary buyer login)
 *   + 3 more sellers (same password) for richer per-seller analytics.
 */

// Deterministic PRNG so reseeds are reproducible.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = makeRng(20260603);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY);

const factor = (code: string) =>
  UNITS.find((u) => u.code === code)!.factorToBase;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, {
    max: 1,
    ssl: url.includes("neon.tech") ? "require" : undefined,
  });
  const db = drizzle(sql, { schema });

  console.log("Clearing existing data...");
  await db.delete(schema.orderStatusHistory);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.products);
  await db.delete(schema.categories);
  await db.delete(schema.units);
  await db.delete(schema.users);

  console.log("Seeding units...");
  await db.insert(schema.units).values(
    UNITS.map((u) => ({
      code: u.code,
      label: u.label,
      dimension: u.dimension,
      factorToBase: u.factorToBase,
    }))
  );

  console.log("Seeding users...");
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const sellerHash = await bcrypt.hash("Seller@123", 10);
  const [admin] = await db
    .insert(schema.users)
    .values({
      email: "admin@aasamed.com",
      name: "Aasa Admin",
      role: "admin",
      passwordHash: adminHash,
    })
    .returning();

  const sellers = await db
    .insert(schema.users)
    .values([
      { email: "seller@aasamed.com", name: "Demo Seller", role: "seller", passwordHash: sellerHash },
      { email: "labpro@aasamed.com", name: "LabPro Distributors", role: "seller", passwordHash: sellerHash },
      { email: "medico@aasamed.com", name: "Medico Supplies", role: "seller", passwordHash: sellerHash },
      { email: "research@aasamed.com", name: "Research Labs Co.", role: "seller", passwordHash: sellerHash },
    ])
    .returning();

  console.log("Seeding categories...");
  const cats = await db
    .insert(schema.categories)
    .values([
      { name: "Reagents & Chemicals", slug: "reagents-chemicals" },
      { name: "Solvents", slug: "solvents" },
      { name: "Glassware & Supplies", slug: "glassware-supplies" },
      { name: "Consumables", slug: "consumables" },
      { name: "Lab Equipment", slug: "lab-equipment" },
    ])
    .returning();
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  console.log("Seeding products...");
  // pricePerDisplayUnit is INR per displayUnit; stock & threshold in stockUnit.
  type Spec = {
    sku: string;
    name: string;
    description: string;
    cat: string;
    dimension: Dimension;
    price: string;
    displayUnit: string;
    stock: string;
    threshold: string;
    stockUnit: string;
  };
  const specs: Spec[] = [
    { sku: "CHM-NACL-001", name: "Sodium Chloride (ACS Grade)", description: "High-purity NaCl, 99.9%, for analytical use.", cat: "reagents-chemicals", dimension: "weight", price: "850.00", displayUnit: "kg", stock: "120", threshold: "15", stockUnit: "kg" },
    { sku: "CHM-AGNO3-002", name: "Silver Nitrate Crystals", description: "Photographic & analytical grade AgNO3.", cat: "reagents-chemicals", dimension: "weight", price: "95.50", displayUnit: "g", stock: "5000", threshold: "500", stockUnit: "g" },
    { sku: "CHM-NAOH-003", name: "Sodium Hydroxide Pellets", description: "NaOH pellets, reagent grade.", cat: "reagents-chemicals", dimension: "weight", price: "420.00", displayUnit: "kg", stock: "80", threshold: "10", stockUnit: "kg" },
    { sku: "CHM-KMNO4-004", name: "Potassium Permanganate", description: "KMnO4 crystals, ACS grade.", cat: "reagents-chemicals", dimension: "weight", price: "1250.00", displayUnit: "kg", stock: "8", threshold: "10", stockUnit: "kg" },
    { sku: "CHM-CUSO4-005", name: "Copper(II) Sulfate Pentahydrate", description: "CuSO4·5H2O, blue crystals.", cat: "reagents-chemicals", dimension: "weight", price: "560.00", displayUnit: "kg", stock: "45", threshold: "10", stockUnit: "kg" },
    { sku: "CHM-CITR-006", name: "Citric Acid Anhydrous", description: "Food & lab grade citric acid.", cat: "reagents-chemicals", dimension: "weight", price: "240.00", displayUnit: "kg", stock: "200", threshold: "20", stockUnit: "kg" },
    { sku: "SOL-ETOH-010", name: "Ethanol Absolute (99.9%)", description: "Denatured absolute ethanol for lab use.", cat: "solvents", dimension: "volume", price: "640.00", displayUnit: "L", stock: "300", threshold: "30", stockUnit: "L" },
    { sku: "SOL-ACET-011", name: "Acetone (HPLC Grade)", description: "High purity acetone, HPLC grade.", cat: "solvents", dimension: "volume", price: "1.20", displayUnit: "mL", stock: "50", threshold: "10", stockUnit: "L" },
    { sku: "SOL-H2O-012", name: "Distilled Water (Lab)", description: "Lab-grade distilled water.", cat: "solvents", dimension: "volume", price: "25.00", displayUnit: "L", stock: "1000", threshold: "100", stockUnit: "L" },
    { sku: "SOL-MEOH-013", name: "Methanol (AR Grade)", description: "Analytical reagent methanol.", cat: "solvents", dimension: "volume", price: "520.00", displayUnit: "L", stock: "150", threshold: "20", stockUnit: "L" },
    { sku: "SOL-IPA-014", name: "Isopropyl Alcohol 99%", description: "IPA 99%, cleaning & lab use.", cat: "solvents", dimension: "volume", price: "380.00", displayUnit: "L", stock: "18", threshold: "25", stockUnit: "L" },
    { sku: "GLW-BEAK-100", name: "Borosilicate Beaker 250mL", description: "Graduated borosilicate glass beaker.", cat: "glassware-supplies", dimension: "count", price: "180.00", displayUnit: "item", stock: "400", threshold: "50", stockUnit: "item" },
    { sku: "GLW-PIP-101", name: "Volumetric Pipette 10mL", description: "Class A volumetric pipette.", cat: "glassware-supplies", dimension: "count", price: "240.00", displayUnit: "item", stock: "150", threshold: "30", stockUnit: "item" },
    { sku: "GLW-FLASK-102", name: "Erlenmeyer Flask 500mL", description: "Conical borosilicate flask, 500 mL.", cat: "glassware-supplies", dimension: "count", price: "320.00", displayUnit: "item", stock: "90", threshold: "20", stockUnit: "item" },
    { sku: "CON-GLOVE-200", name: "Nitrile Gloves (Box of 100)", description: "Powder-free nitrile examination gloves.", cat: "consumables", dimension: "count", price: "650.00", displayUnit: "item", stock: "60", threshold: "25", stockUnit: "item" },
    { sku: "CON-FILT-201", name: "Filter Paper (Pack of 100)", description: "Qualitative filter paper, 11 cm.", cat: "consumables", dimension: "count", price: "420.00", displayUnit: "item", stock: "12", threshold: "20", stockUnit: "item" },
    { sku: "EQP-HOT-300", name: "Magnetic Hotplate Stirrer", description: "Digital hotplate with magnetic stirrer.", cat: "lab-equipment", dimension: "count", price: "14500.00", displayUnit: "item", stock: "15", threshold: "5", stockUnit: "item" },
    { sku: "EQP-BAL-301", name: "Analytical Balance 0.1mg", description: "Precision analytical balance.", cat: "lab-equipment", dimension: "count", price: "62000.00", displayUnit: "item", stock: "6", threshold: "3", stockUnit: "item" },
  ];

  const products = await db
    .insert(schema.products)
    .values(
      specs.map((p) => ({
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryId: catBySlug[p.cat],
        dimension: p.dimension,
        baseUnit: BASE_UNIT[p.dimension],
        basePrice: pricePerDisplayUnitToBase(p.price, p.displayUnit).toString(),
        stockBaseQty: new Decimal(p.stock).mul(factor(p.stockUnit)).toString(),
        lowStockThreshold: new Decimal(p.threshold).mul(factor(p.stockUnit)).toString(),
      }))
    )
    .returning();

  console.log("Seeding orders over the last 90 days...");
  const STATUSES = ["pending", "quoted", "confirmed", "rejected", "fulfilled"] as const;
  // Weighted status distribution: most historical orders are fulfilled/confirmed.
  const statusPool: (typeof STATUSES)[number][] = [
    "fulfilled", "fulfilled", "fulfilled", "fulfilled", "fulfilled",
    "confirmed", "confirmed", "confirmed",
    "quoted", "quoted",
    "pending", "pending",
    "rejected",
  ];
  const notes = [
    "Need delivery within 2 weeks.",
    "Urgent — for upcoming experiment batch.",
    "Repeat purchase.",
    "Please confirm best price.",
    "Standard monthly restock.",
    null,
    null,
  ];

  const ORDER_COUNT = 28;
  for (let i = 0; i < ORDER_COUNT; i++) {
    const seller = pick(sellers);
    const status = pick(statusPool);
    const type: "quotation" | "order" =
      status === "pending" || status === "quoted" || status === "rejected"
        ? "quotation"
        : "order";
    const createdAt = daysAgo(randInt(0, 90) + rand());

    // 1–4 distinct line items.
    const lineCount = randInt(1, 4);
    const chosen = new Set<number>();
    while (chosen.size < lineCount) chosen.add(randInt(0, products.length - 1));

    let total = new Decimal(0);
    const items: (typeof schema.orderItems.$inferInsert)[] = [];
    for (const idx of chosen) {
      const product = products[idx];
      const dim = product.dimension as Dimension;
      const unit = pick(unitsForDimension(dim)).code;
      // Reasonable quantity per unit type.
      const qty =
        unit === "g" ? randInt(50, 800).toString()
        : unit === "mL" ? randInt(100, 900).toString()
        : unit === "kg" || unit === "L" ? randInt(1, 12).toString()
        : randInt(1, 20).toString(); // item
      const { baseQty, lineTotal } = calcLineTotal(qty, unit, product.basePrice);
      total = total.add(lineTotal);
      items.push({
        orderId: "",
        productId: product.id,
        orderedQty: new Decimal(qty).toString(),
        orderedUnit: unit,
        baseQty: baseQty.toString(),
        unitPriceBase: product.basePrice,
        lineTotal: lineTotal.toString(),
        productName: product.name,
        productSku: product.sku,
      });
    }

    const [order] = await db
      .insert(schema.orders)
      .values({
        userId: seller.id,
        type,
        status,
        total: total.toString(),
        note: pick(notes),
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    await db.insert(schema.orderItems).values(items.map((it) => ({ ...it, orderId: order.id })));

    // Status history: pending at creation, then the final status a bit later.
    const history: (typeof schema.orderStatusHistory.$inferInsert)[] = [
      { orderId: order.id, status: "pending", note: "Order placed.", changedBy: seller.id, createdAt },
    ];
    if (status !== "pending") {
      const later = new Date(createdAt.getTime() + randInt(2, 72) * 60 * 60 * 1000);
      history.push({
        orderId: order.id,
        status,
        note:
          status === "rejected" ? "Items unavailable for requested timeline."
          : status === "quoted" ? "Quotation prepared."
          : status === "confirmed" ? "Order confirmed."
          : "Order fulfilled and dispatched.",
        changedBy: admin.id,
        createdAt: later,
      });
    }
    await db.insert(schema.orderStatusHistory).values(history);
  }

  console.log("\nSeed complete.");
  console.log("  Admin : admin@aasamed.com  / Admin@123");
  console.log("  Seller: seller@aasamed.com / Seller@123  (+3 more sellers, same password)");
  console.log(`  Products: ${products.length}, Sellers: ${sellers.length}, Orders: ${ORDER_COUNT}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
