import { formatINR, formatQty } from "@/lib/units";
import StatusBadge from "./status-badge";

export interface OrderItemView {
  id: string;
  productName: string;
  productSku: string;
  orderedQty: string;
  orderedUnit: string;
  baseQty: string;
  unitPriceBase: string;
  lineTotal: string;
}

export interface OrderView {
  id: string;
  type: string;
  status: string;
  total: string;
  note: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
  items: OrderItemView[];
}

/**
 * Renders an order/quotation with a per-line conversion breakdown so the math
 * is auditable:  orderedQty unit  =  baseQty baseUnit × rate  =  lineTotal.
 * `actions` is an optional slot (e.g. admin status control).
 */
export default function OrderCard({
  order,
  actions,
}: {
  order: OrderView;
  actions?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">
              #{order.id.slice(0, 8)}
            </span>
            <span className="badge bg-slate-100 capitalize text-slate-600">
              {order.type}
            </span>
            <StatusBadge status={order.status} />
          </div>
          {order.user && (
            <div className="mt-1 text-sm text-slate-600">
              {order.user.name}{" "}
              <span className="text-slate-400">({order.user.email})</span>
            </div>
          )}
          <div className="text-xs text-slate-400">
            {new Date(order.createdAt).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-400">Total</div>
          <div className="text-lg font-bold text-slate-900">
            {formatINR(order.total)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-th">Product</th>
              <th className="table-th">Ordered</th>
              <th className="table-th">Converted to base</th>
              <th className="table-th">Rate (per base)</th>
              <th className="table-th text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {order.items.map((it) => {
              const baseUnit = inferBaseUnit(it.orderedUnit);
              return (
                <tr key={it.id}>
                  <td className="table-td">
                    <div className="font-medium text-slate-800">
                      {it.productName}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {it.productSku}
                    </div>
                  </td>
                  <td className="table-td">
                    {formatQty(it.orderedQty, it.orderedUnit)}
                  </td>
                  <td className="table-td text-slate-500">
                    {formatQty(it.baseQty, baseUnit)}
                  </td>
                  <td className="table-td text-slate-500">
                    {formatINR(it.unitPriceBase)} / {baseUnit}
                  </td>
                  <td className="table-td text-right font-medium">
                    {formatINR(it.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {order.note && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium">Note:</span> {order.note}
        </p>
      )}

      {actions && <div className="mt-4 flex justify-end">{actions}</div>}
    </div>
  );
}

/** Map an ordered unit to its dimension's base unit (for display only). */
function inferBaseUnit(orderedUnit: string): string {
  if (orderedUnit === "g" || orderedUnit === "kg") return "g";
  if (orderedUnit === "mL" || orderedUnit === "L") return "mL";
  return "item";
}
