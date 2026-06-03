"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OrderCard, { type OrderView } from "@/components/order-card";

const STATUSES = ["pending", "quoted", "confirmed", "rejected", "fulfilled"] as const;

export default function AdminOrderList({ orders }: { orders: OrderView[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter ? orders.filter((o) => o.status === filter) : orders),
    [orders, filter]
  );

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select
          className="input max-w-[200px]"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {filtered.length} order{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-4">
        {filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            actions={
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">Set status:</label>
                <select
                  className="input max-w-[180px]"
                  value={order.status}
                  disabled={busyId === order.id}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        ))}
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-slate-400">
            No orders to show.
          </div>
        )}
      </div>
    </div>
  );
}
