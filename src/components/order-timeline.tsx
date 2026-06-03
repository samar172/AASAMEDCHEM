import StatusBadge from "./status-badge";

export interface TimelineEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  changedByName: string | null;
}

/** Vertical status-history timeline for an order. */
export default function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {entries.map((e) => (
        <li key={e.id} className="mb-5 ml-4">
          <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
          <div className="flex items-center gap-2">
            <StatusBadge status={e.status} />
            <span className="text-xs text-slate-400">
              {new Date(e.createdAt).toLocaleString("en-IN")}
            </span>
          </div>
          {e.note && <p className="mt-1 text-sm text-slate-600">{e.note}</p>}
          {e.changedByName && (
            <p className="mt-0.5 text-xs text-slate-400">by {e.changedByName}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
