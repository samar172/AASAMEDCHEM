import { desc } from "drizzle-orm";
import { db } from "@/db";
import { orders as ordersTable } from "@/db/schema";
import AdminOrderList from "./order-list";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await db.query.orders.findMany({
    orderBy: desc(ordersTable.createdAt),
    with: { items: true, user: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Quotations &amp; Orders</h1>
        <p className="text-sm text-slate-500">
          Review incoming requests, verify pricing/conversions, and update status.
        </p>
      </div>
      <AdminOrderList orders={JSON.parse(JSON.stringify(orders))} />
    </div>
  );
}
