"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["pending", "quoted", "confirmed", "rejected", "fulfilled"] as const;

export default function StatusForm({
  orderId,
  current,
}: {
  orderId: string;
  current: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Update failed");
        return;
      }
      setNote("");
      setMsg(
        data.stockDeducted
          ? "Status updated — stock deducted."
          : "Status updated."
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {msg && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      )}
      <div>
        <label className="label">Status</label>
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Note (added to timeline, optional)</label>
        <textarea
          className="input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Confirmed; dispatching Monday."
        />
      </div>
      <button className="btn-primary w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Update status"}
      </button>
    </div>
  );
}
