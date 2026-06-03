import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSellerDashboard } from "@/lib/analytics";
import KpiCard from "@/components/kpi-card";
import { RevenueAreaChart, StatusDonut } from "@/components/charts";
import StatusBadge from "@/components/status-badge";
import { formatINR } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const d = await getSellerDashboard(session.sub);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, {session.name}. Here&apos;s your activity.
          </p>
        </div>
        <Link href="/seller/products" className="btn-primary">
          + New quotation
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total spend"
          value={formatINR(d.kpis.totalSpend)}
          sub="Confirmed + fulfilled"
          accent="emerald"
        />
        <KpiCard label="Total orders" value={String(d.kpis.totalOrders)} />
        <KpiCard
          label="Open quotations"
          value={String(d.kpis.openQuotations)}
          sub="Awaiting response"
          accent="amber"
        />
        <KpiCard
          label="Latest status"
          value={d.kpis.lastStatus ? capitalize(d.kpis.lastStatus) : "—"}
          accent="brand"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            My spend over time (weekly)
          </h2>
          {d.spendOverTime.length ? (
            <RevenueAreaChart
              data={d.spendOverTime}
              dataKey="spend"
              color="#059669"
            />
          ) : (
            <Empty />
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            My orders by status
          </h2>
          {d.ordersByStatus.length ? (
            <StatusDonut data={d.ordersByStatus} />
          ) : (
            <Empty />
          )}
        </div>
      </div>

      {d.kpis.lastStatus && (
        <p className="mt-4 text-sm text-slate-500">
          Track all your requests under{" "}
          <Link href="/seller/orders" className="text-brand-600 hover:underline">
            My Orders
          </Link>{" "}
          <StatusBadge status={d.kpis.lastStatus} />
        </p>
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Empty() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
      No data yet — place your first order.
    </div>
  );
}
