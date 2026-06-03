import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { db } from "@/db";
import { orders, orderItems, products, orderStatusHistory } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { calcLineTotal } from "@/lib/units";

/**
 * POST /api/orders/:id/reorder (seller)
 * Clones the items of one of the seller's past orders into a NEW pending
 * quotation, re-priced from current product rows (prices may have changed).
 * Inactive/removed products are skipped.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "seller") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const source = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load current product rows for the source items.
  const productIds = [...new Set(source.items.map((i) => i.productId))];
  const current = await db.query.products.findMany({
    where: inArray(products.id, productIds),
  });
  const byId = new Map(current.map((p) => [p.id, p]));

  let total = new Decimal(0);
  const newItems: (typeof orderItems.$inferInsert)[] = [];
  const skipped: string[] = [];

  for (const item of source.items) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) {
      skipped.push(item.productName);
      continue;
    }
    const { baseQty, lineTotal } = calcLineTotal(
      item.orderedQty,
      item.orderedUnit,
      product.basePrice
    );
    total = total.add(lineTotal);
    newItems.push({
      orderId: "",
      productId: product.id,
      orderedQty: item.orderedQty,
      orderedUnit: item.orderedUnit,
      baseQty: baseQty.toString(),
      unitPriceBase: product.basePrice,
      lineTotal: lineTotal.toString(),
      productName: product.name,
      productSku: product.sku,
    });
  }

  if (newItems.length === 0) {
    return NextResponse.json(
      { error: "None of the products are available to reorder." },
      { status: 400 }
    );
  }

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.sub,
        type: "quotation",
        status: "pending",
        total: total.toString(),
        note: `Reorder of #${source.id.slice(0, 8)}`,
      })
      .returning();
    await tx
      .insert(orderItems)
      .values(newItems.map((it) => ({ ...it, orderId: order.id })));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: "pending",
      note: "Reorder placed.",
      changedBy: session.sub,
    });
    return order;
  });

  return NextResponse.json({ order: created, skipped }, { status: 201 });
}
