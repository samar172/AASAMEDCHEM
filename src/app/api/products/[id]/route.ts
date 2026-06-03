import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { productInputSchema } from "@/lib/validation";
import {
  BASE_UNIT,
  pricePerDisplayUnitToBase,
  toBase,
  validateUnitsMatchDimension,
} from "@/lib/units";

/** PATCH /api/products/:id (admin) — update a product. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

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

  const [updated] = await db
    .update(products)
    .set({
      sku: input.sku,
      name: input.name,
      description: input.description || null,
      categoryId: input.categoryId ?? null,
      dimension: input.dimension,
      baseUnit: BASE_UNIT[input.dimension],
      basePrice: pricePerDisplayUnitToBase(
        input.pricePerDisplayUnit,
        input.priceUnit
      ).toString(),
      stockBaseQty: toBase(input.stockQty, input.stockUnit).toString(),
      lowStockThreshold: toBase(
        input.lowStockThreshold ?? "0",
        input.stockUnit
      ).toString(),
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ product: updated });
}

/** DELETE /api/products/:id (admin). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // FK violation: product referenced by an order.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23503"
    ) {
      return NextResponse.json(
        { error: "Cannot delete: product is used in existing orders. Deactivate it instead." },
        { status: 409 }
      );
    }
    throw err;
  }
}
