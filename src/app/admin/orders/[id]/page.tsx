import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderStatusHistory } from "@/db/schema";
import OrderCard, { type OrderView } from "@/components/order-card";
import OrderTimeline, { type TimelineEntry } from "@/components/order-timeline";
import StatusForm from "./status-form";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: true,
      user: true,
      statusHistory: {
        with: { changedByUser: true },
        orderBy: asc(orderStatusHistory.createdAt),
      },
    },
  });
  if (!order) notFound();

  const orderView: OrderView = JSON.parse(JSON.stringify(order));
  const timeline: TimelineEntry[] = order.statusHistory.map((h) => ({
    id: h.id,
    status: h.status,
    note: h.note,
    createdAt: h.createdAt.toISOString(),
    changedByName: h.changedByUser?.name ?? null,
  }));

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-block text-sm text-brand-600 hover:underline"
      >
        ← Back to orders
      </Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderCard order={orderView} />
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Update status
            </h2>
            <StatusForm orderId={order.id} current={order.status} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Timeline</h2>
            <OrderTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
