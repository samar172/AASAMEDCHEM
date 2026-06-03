import { asc } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { db } from "@/db";
import { products as productsTable } from "@/db/schema";
import {
  PREFERRED_DISPLAY_UNIT,
  basePriceToDisplayUnit,
  formatINR,
  formatQty,
  fromBase,
  type Dimension,
} from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.name));

  const totalValue = products.reduce(
    (acc, p) => acc.add(new Decimal(p.stockBaseQty).mul(p.basePrice)),
    new Decimal(0)
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">
            Current stock levels (shown in friendly units).
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-400">
            Total stock value
          </div>
          <div className="text-xl font-bold text-slate-900">
            {formatINR(totalValue)}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="table-th">SKU</th>
              <th className="table-th">Product</th>
              <th className="table-th">Stock (friendly)</th>
              <th className="table-th">Stock (base unit)</th>
              <th className="table-th">Rate</th>
              <th className="table-th text-right">Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const dim = p.dimension as Dimension;
              const dispUnit = PREFERRED_DISPLAY_UNIT[dim];
              const friendly = fromBase(p.stockBaseQty, dispUnit);
              const rate = basePriceToDisplayUnit(p.basePrice, dispUnit);
              const value = new Decimal(p.stockBaseQty).mul(p.basePrice);
              const low = friendly.lessThan(dim === "count" ? 20 : 10);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs">{p.sku}</td>
                  <td className="table-td font-medium text-slate-900">
                    {p.name}
                  </td>
                  <td className="table-td">
                    <span className={low ? "font-semibold text-red-600" : ""}>
                      {formatQty(friendly, dispUnit)}
                    </span>
                    {low && (
                      <span className="badge ml-2 bg-red-50 text-red-700">
                        Low
                      </span>
                    )}
                  </td>
                  <td className="table-td text-slate-500">
                    {formatQty(p.stockBaseQty, p.baseUnit)}
                  </td>
                  <td className="table-td">
                    {formatINR(rate)}{" "}
                    <span className="text-slate-400">/ {dispUnit}</span>
                  </td>
                  <td className="table-td text-right">{formatINR(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
