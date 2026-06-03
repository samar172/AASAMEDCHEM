"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reorder() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Reorder failed");
        return;
      }
      if (data.skipped?.length) {
        alert(
          `Reordered. Skipped (unavailable): ${data.skipped.join(", ")}`
        );
      }
      router.push(`/seller/orders/${data.order.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-secondary" onClick={reorder} disabled={loading}>
      {loading ? "Reordering…" : "↻ Reorder"}
    </button>
  );
}
