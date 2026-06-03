import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders as ordersTable } from "@/db/schema";
import { getSession } from "@/lib/auth";
import OrderCard from "@/components/order-card";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const session = await getSession();
  const myOrders = await db.query.orders.findMany({
    where: eq(ordersTable.userId, session!.sub),
    orderBy: desc(ordersTable.createdAt),
    with: { items: true },
  });

  const serialised = JSON.parse(JSON.stringify(myOrders));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
        <p className="text-sm text-slate-500">
          Your quotations and orders, with current status.
        </p>
      </div>
      <div className="space-y-4">
        {serialised.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">
            You haven&apos;t placed any quotations or orders yet.
          </div>
        ) : (
          serialised.map((o: Parameters<typeof OrderCard>[0]["order"]) => (
            <OrderCard key={o.id} order={o} />
          ))
        )}
      </div>
    </div>
  );
}
