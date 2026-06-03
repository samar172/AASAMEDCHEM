import Link from "next/link";
import { getAdminDashboard } from "@/lib/analytics";
import KpiCard from "@/components/kpi-card";
import { RevenueAreaChart, StatusDonut, HorizontalBar } from "@/components/charts";
import StatusBadge from "@/components/status-badge";
import {
  PREFERRED_DISPLAY_UNIT,
  formatINR,
  formatQty,
  fromBase,
  type Dimension,
} from "@/lib/units";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const d = await getAdminDashboard();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Business overview — revenue, orders, and inventory health.
        </p>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Realised revenue"
          value={formatINR(d.kpis.totalRevenue)}
          sub="Confirmed + fulfilled"
          accent="emerald"
        />
        <KpiCard label="Total orders" value={String(d.kpis.totalOrders)} sub="All time" />
        <KpiCard
          label="Open quotations"
          value={String(d.kpis.openQuotations)}
          sub="Pending + quoted"
          accent="amber"
        />
        <KpiCard
          label="Low stock items"
          value={String(d.kpis.lowStockCount)}
          sub="At/below threshold"
          accent={d.kpis.lowStockCount > 0 ? "red" : "emerald"}
        />
        <KpiCard
          label="Inventory value"
          value={formatINR(d.kpis.inventoryValue)}
          sub="Stock × rate"
          accent="brand"
        />
        <KpiCard label="Avg order value" value={formatINR(d.kpis.avgOrderValue)} />
        <KpiCard label="Products" value={String(d.kpis.totalProducts)} />
        <KpiCard label="Active sellers" value={String(d.kpis.activeSellers)} />
      </div>

      {/* Charts row 1 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Revenue over time (weekly)" className="lg:col-span-2">
          {d.revenueOverTime.length ? (
            <RevenueAreaChart data={d.revenueOverTime} />
          ) : (
            <Empty />
          )}
        </Section>
        <Section title="Orders by status">
          {d.ordersByStatus.length ? <StatusDonut data={d.ordersByStatus} /> : <Empty />}
        </Section>
      </div>

      {/* Charts row 2 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Top products by revenue">
          {d.topProducts.length ? (
            <HorizontalBar data={d.topProducts} labelKey="name" valueKey="revenue" />
          ) : (
            <Empty />
          )}
        </Section>
        <Section title="Revenue by category">
          {d.revenueByCategory.length ? (
            <HorizontalBar
              data={d.revenueByCategory}
              labelKey="category"
              valueKey="revenue"
            />
          ) : (
            <Empty />
          )}
        </Section>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Low-stock alerts">
          {d.lowStock.length ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th">Product</th>
                  <th className="table-th">In stock</th>
                  <th className="table-th">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.lowStock.map((p) => {
                  const u = PREFERRED_DISPLAY_UNIT[p.dimension as Dimension];
                  return (
                    <tr key={p.id}>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                      </td>
                      <td className="table-td font-semibold text-red-600">
                        {formatQty(fromBase(p.stockBaseQty, u), u)}
                      </td>
                      <td className="table-td text-slate-500">
                        {formatQty(fromBase(p.lowStockThreshold, u), u)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-emerald-600">All products are above threshold. 🎉</p>
          )}
        </Section>

        <Section title="Recent orders">
          <div className="divide-y divide-slate-50">
            {d.recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {o.sellerName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString("en-IN")} ·{" "}
                    <span className="capitalize">{o.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  <span className="text-sm font-semibold text-slate-900">
                    {formatINR(o.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
      No data yet.
    </div>
  );
}
