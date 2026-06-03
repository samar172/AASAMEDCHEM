import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { db } from "@/db";
import { orders, orderItems, products } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { orderInputSchema } from "@/lib/validation";
import { calcLineTotal, getUnit } from "@/lib/units";

/** GET /api/orders — admin sees all; seller sees only their own. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.orders.findMany({
    where: session.role === "admin" ? undefined : eq(orders.userId, session.sub),
    orderBy: desc(orders.createdAt),
    with: { items: true, user: true },
  });
  return NextResponse.json({ orders: rows });
}

/**
 * POST /api/orders (seller) — create a quotation/order.
 * Pricing is ALWAYS recomputed on the server from the current product rows;
 * the client-sent totals are never trusted.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "seller") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Load all referenced products in one query.
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const productRows = await db.query.products.findMany({
    where: inArray(products.id, ids),
  });
  const byId = new Map(productRows.map((p) => [p.id, p]));

  // Validate every line and recompute pricing.
  const computed: Array<typeof orderItems.$inferInsert> = [];
  let grandTotal = new Decimal(0);

  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product) {
      return NextResponse.json(
        { error: `Unknown product: ${item.productId}` },
        { status: 400 }
      );
    }
    if (!product.isActive) {
      return NextResponse.json(
        { error: `Product is inactive: ${product.name}` },
        { status: 400 }
      );
    }
    // Ordered unit must belong to the product's dimension.
    const unit = getUnit(item.orderedUnit);
    if (unit.dimension !== product.dimension) {
      return NextResponse.json(
        {
          error: `Unit "${item.orderedUnit}" is not valid for ${product.name} (${product.dimension}).`,
        },
        { status: 400 }
      );
    }

    const { baseQty, lineTotal } = calcLineTotal(
      item.orderedQty,
      item.orderedUnit,
      product.basePrice
    );
    grandTotal = grandTotal.add(lineTotal);

    computed.push({
      orderId: "", // set after order insert
      productId: product.id,
      orderedQty: new Decimal(item.orderedQty).toString(),
      orderedUnit: item.orderedUnit,
      baseQty: baseQty.toString(),
      unitPriceBase: product.basePrice,
      lineTotal: lineTotal.toString(),
      productName: product.name,
      productSku: product.sku,
    });
  }

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.sub,
        type: input.type,
        status: "pending",
        total: grandTotal.toString(),
        note: input.note || null,
      })
      .returning();

    await tx
      .insert(orderItems)
      .values(computed.map((c) => ({ ...c, orderId: order.id })));

    return order;
  });

  return NextResponse.json({ order: result }, { status: 201 });
}
