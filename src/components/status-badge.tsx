const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  quoted: "bg-blue-50 text-blue-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  fulfilled: "bg-slate-100 text-slate-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
