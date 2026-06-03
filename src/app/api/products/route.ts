import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getSession, requireRole } from "@/lib/auth";
import { productInputSchema } from "@/lib/validation";
import { BASE_UNIT, pricePerDisplayUnitToBase, toBase } from "@/lib/units";

/** GET /api/products?q=&dimension=&categoryId=&activeOnly=1 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const dimension = url.searchParams.get("dimension");
  const categoryId = url.searchParams.get("categoryId");
  // Sellers always see active products only.
  const activeOnly =
    session.role === "seller" || url.searchParams.get("activeOnly") === "1";

  const conditions: SQL[] = [];
  if (q) {
    conditions.push(
      or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`))!
    );
  }
  if (dimension === "weight" || dimension === "volume" || dimension === "count") {
    conditions.push(eq(products.dimension, dimension));
  }
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (activeOnly) conditions.push(eq(products.isActive, true));

  const rows = await db.query.products.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(products.createdAt),
    with: { category: true },
  });

  return NextResponse.json({ products: rows });
}

/** POST /api/products (admin) — create a product. */
export async function POST(req: Request) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const validation = validateUnitsMatchDimension(input);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  // Convert price-per-display-unit -> price-per-base-unit, and stock -> base.
  const basePrice = pricePerDisplayUnitToBase(
    input.pricePerDisplayUnit,
    input.priceUnit
  ).toString();
  const stockBaseQty = toBase(input.stockQty, input.stockUnit).toString();

  try {
    const [created] = await db
      .insert(products)
      .values({
        sku: input.sku,
        name: input.name,
        description: input.description || null,
        categoryId: input.categoryId ?? null,
        dimension: input.dimension,
        baseUnit: BASE_UNIT[input.dimension],
        basePrice,
        stockBaseQty,
        isActive: input.isActive ?? true,
      })
      .returning();
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    throw err;
  }
}

/** The chosen price/stock units must belong to the product's dimension. */
export function validateUnitsMatchDimension(input: {
  dimension: "weight" | "volume" | "count";
  priceUnit: string;
  stockUnit: string;
}): string | null {
  const dims: Record<string, string[]> = {
    weight: ["g", "kg"],
    volume: ["mL", "L"],
    count: ["item"],
  };
  const allowed = dims[input.dimension];
  if (!allowed.includes(input.priceUnit))
    return `Price unit must be one of: ${allowed.join(", ")}`;
  if (!allowed.includes(input.stockUnit))
    return `Stock unit must be one of: ${allowed.join(", ")}`;
  return null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
