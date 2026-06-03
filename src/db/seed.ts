import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { UNITS, BASE_UNIT, pricePerDisplayUnitToBase, calcLineTotal } from "../lib/units";
import { Decimal } from "decimal.js";

/**
 * Idempotent-ish seed: wipes domain tables and inserts a clean demo dataset.
 * Run with: npm run db:seed
 *
 * Test credentials created:
 *   admin@aasamed.com  / Admin@123   (role: admin)
 *   seller@aasamed.com / Seller@123  (role: seller)
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, {
    max: 1,
    ssl: url.includes("neon.tech") ? "require" : undefined,
  });
  const db = drizzle(sql, { schema });

  console.log("Clearing existing data...");
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
  const [admin, seller] = await db
    .insert(schema.users)
    .values([
      {
        email: "admin@aasamed.com",
        name: "Aasa Admin",
        role: "admin" as const,
        passwordHash: await bcrypt.hash("Admin@123", 10),
      },
      {
        email: "seller@aasamed.com",
        name: "Demo Seller",
        role: "seller" as const,
        passwordHash: await bcrypt.hash("Seller@123", 10),
      },
    ])
    .returning();

  console.log("Seeding categories...");
  const [chemicals, solvents, glassware] = await db
    .insert(schema.categories)
    .values([
      { name: "Reagents & Chemicals", slug: "reagents-chemicals" },
      { name: "Solvents", slug: "solvents" },
      { name: "Glassware & Supplies", slug: "glassware-supplies" },
    ])
    .returning();

  console.log("Seeding products...");
  // Each product: admin configures price per a friendly display unit; we store
  // the equivalent INR-per-base-unit so all downstream math is uniform.
  const productSpecs: Array<{
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    dimension: "weight" | "volume" | "count";
    pricePerDisplayUnit: string;
    displayUnit: string;
    stockDisplayQty: string;
    stockUnit: string;
  }> = [
    {
      sku: "CHM-NACL-001",
      name: "Sodium Chloride (ACS Grade)",
      description: "High-purity NaCl, 99.9%, suitable for analytical use.",
      categoryId: chemicals.id,
      dimension: "weight",
      pricePerDisplayUnit: "850.00", // INR per kg
      displayUnit: "kg",
      stockDisplayQty: "120", // kg
      stockUnit: "kg",
    },
    {
      sku: "CHM-AGNO3-002",
      name: "Silver Nitrate Crystals",
      description: "Photographic & analytical grade AgNO3.",
      categoryId: chemicals.id,
      dimension: "weight",
      pricePerDisplayUnit: "95.50", // INR per g (expensive -> per gram)
      displayUnit: "g",
      stockDisplayQty: "5000", // g
      stockUnit: "g",
    },
    {
      sku: "SOL-ETOH-010",
      name: "Ethanol Absolute (99.9%)",
      description: "Denatured absolute ethanol for lab use.",
      categoryId: solvents.id,
      dimension: "volume",
      pricePerDisplayUnit: "640.00", // INR per L
      displayUnit: "L",
      stockDisplayQty: "300", // L
      stockUnit: "L",
    },
    {
      sku: "SOL-ACET-011",
      name: "Acetone (HPLC Grade)",
      description: "High purity acetone, HPLC grade.",
      categoryId: solvents.id,
      dimension: "volume",
      pricePerDisplayUnit: "1.20", // INR per mL
      displayUnit: "mL",
      stockDisplayQty: "50000", // mL
      stockUnit: "mL",
    },
    {
      sku: "GLW-BEAK-100",
      name: "Borosilicate Beaker 250mL",
      description: "Graduated borosilicate glass beaker, 250 mL.",
      categoryId: glassware.id,
      dimension: "count",
      pricePerDisplayUnit: "180.00", // INR per item
      displayUnit: "item",
      stockDisplayQty: "400",
      stockUnit: "item",
    },
    {
      sku: "GLW-PIP-101",
      name: "Volumetric Pipette 10mL",
      description: "Class A volumetric pipette, 10 mL.",
      categoryId: glassware.id,
      dimension: "count",
      pricePerDisplayUnit: "240.00",
      displayUnit: "item",
      stockDisplayQty: "150",
      stockUnit: "item",
    },
    {
      sku: "CHM-NAOH-003",
      name: "Sodium Hydroxide Pellets",
      description: "NaOH pellets, reagent grade.",
      categoryId: chemicals.id,
      dimension: "weight",
      pricePerDisplayUnit: "420.00", // INR per kg
      displayUnit: "kg",
      stockDisplayQty: "80",
      stockUnit: "kg",
    },
    {
      sku: "SOL-H2O-012",
      name: "Distilled Water (Lab)",
      description: "Lab-grade distilled water.",
      categoryId: solvents.id,
      dimension: "volume",
      pricePerDisplayUnit: "25.00", // INR per L
      displayUnit: "L",
      stockDisplayQty: "1000",
      stockUnit: "L",
    },
  ];

  const insertedProducts = await db
    .insert(schema.products)
    .values(
      productSpecs.map((p) => ({
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        dimension: p.dimension,
        baseUnit: BASE_UNIT[p.dimension],
        basePrice: pricePerDisplayUnitToBase(
          p.pricePerDisplayUnit,
          p.displayUnit
        ).toString(),
        stockBaseQty: new Decimal(p.stockDisplayQty)
          .mul(UNITS.find((u) => u.code === p.stockUnit)!.factorToBase)
          .toString(),
      }))
    )
    .returning();

  console.log("Seeding demo orders...");
  // Demo quotation from the seller: 2 kg NaCl + 500 mL Ethanol.
  const nacl = insertedProducts.find((p) => p.sku === "CHM-NACL-001")!;
  const etoh = insertedProducts.find((p) => p.sku === "SOL-ETOH-010")!;

  const line1 = calcLineTotal("2", "kg", nacl.basePrice);
  const line2 = calcLineTotal("500", "mL", etoh.basePrice);
  const total1 = line1.lineTotal.add(line2.lineTotal);

  const [order1] = await db
    .insert(schema.orders)
    .values({
      userId: seller.id,
      type: "quotation" as const,
      status: "pending" as const,
      total: total1.toString(),
      note: "Need delivery within 2 weeks.",
    })
    .returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: order1.id,
      productId: nacl.id,
      orderedQty: "2",
      orderedUnit: "kg",
      baseQty: line1.baseQty.toString(),
      unitPriceBase: nacl.basePrice,
      lineTotal: line1.lineTotal.toString(),
      productName: nacl.name,
      productSku: nacl.sku,
    },
    {
      orderId: order1.id,
      productId: etoh.id,
      orderedQty: "500",
      orderedUnit: "mL",
      baseQty: line2.baseQty.toString(),
      unitPriceBase: etoh.basePrice,
      lineTotal: line2.lineTotal.toString(),
      productName: etoh.name,
      productSku: etoh.sku,
    },
  ]);

  // A second, already-confirmed order to show varied statuses.
  const beaker = insertedProducts.find((p) => p.sku === "GLW-BEAK-100")!;
  const line3 = calcLineTotal("12", "item", beaker.basePrice);
  const [order2] = await db
    .insert(schema.orders)
    .values({
      userId: seller.id,
      type: "order" as const,
      status: "confirmed" as const,
      total: line3.lineTotal.toString(),
      note: "Repeat purchase.",
    })
    .returning();
  await db.insert(schema.orderItems).values({
    orderId: order2.id,
    productId: beaker.id,
    orderedQty: "12",
    orderedUnit: "item",
    baseQty: line3.baseQty.toString(),
    unitPriceBase: beaker.basePrice,
    lineTotal: line3.lineTotal.toString(),
    productName: beaker.name,
    productSku: beaker.sku,
  });

  console.log("\nSeed complete.");
  console.log("  Admin : admin@aasamed.com  / Admin@123");
  console.log("  Seller: seller@aasamed.com / Seller@123");
  console.log(`  Products: ${insertedProducts.length}, Orders: 2`);
  void admin;
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
