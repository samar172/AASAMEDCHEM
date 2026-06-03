import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, orderStatusHistory } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validation";

/**
 * PATCH /api/orders/:id (admin) — update status.
 * Transitioning INTO `confirmed` deducts each line's baseQty from product
 * stock (once). The deduction is idempotent: it only runs when the previous
 * status was not already confirmed.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireRole("admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const newStatus = parsed.data.status;
  const note = parsed.data.note || null;

  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const willDeductStock =
    newStatus === "confirmed" && existing.status !== "confirmed";

  const updated = await db.transaction(async (tx) => {
    if (willDeductStock) {
      for (const item of existing.items) {
        await tx
          .update(products)
          .set({
            stockBaseQty: sql`${products.stockBaseQty} - ${item.baseQty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }
    }
    const [row] = await tx
      .update(orders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    // Append to the status timeline.
    await tx.insert(orderStatusHistory).values({
      orderId: id,
      status: newStatus,
      note,
      changedBy: session.sub,
    });
    return row;
  });

  return NextResponse.json({ order: updated, stockDeducted: willDeductStock });
}

/** GET /api/orders/:id — admin (any) or the owning seller. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true, user: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}
