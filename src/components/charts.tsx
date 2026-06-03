"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

/** Compact INR for axes/tooltips, e.g. ₹2.6L, ₹26k. */
function inrCompact(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function inrFull(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  quoted: "#3b82f6",
  confirmed: "#10b981",
  rejected: "#ef4444",
  fulfilled: "#64748b",
};

const BAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
];

function fmtWeek(period: string): string {
  // period is YYYY-MM-DD (week start)
  const d = new Date(period);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function RevenueAreaChart({
  data,
  dataKey = "revenue",
  color = "#2563eb",
}: {
  data: { period: string; [k: string]: number | string }[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="period"
          tickFormatter={fmtWeek}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
        />
        <YAxis
          tickFormatter={inrCompact}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          width={70}
        />
        <Tooltip
          formatter={(v: number) => [inrFull(v), "Revenue"]}
          labelFormatter={(l) => `Week of ${fmtWeek(String(l))}`}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number, n) => [v, String(n)]} />
        <Legend
          formatter={(v) => <span className="text-xs capitalize">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBar({
  data,
  labelKey,
  valueKey,
  money = true,
}: {
  data: Record<string, number | string>[];
  labelKey: string;
  valueKey: string;
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={money ? inrCompact : undefined}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={150}
          tick={{ fontSize: 11, fill: "#475569" }}
        />
        <Tooltip
          formatter={(v: number) => [money ? inrFull(v) : v, "Revenue"]}
        />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
