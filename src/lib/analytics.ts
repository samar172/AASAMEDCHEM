import "server-only";
import { sql, and, eq, inArray, desc, lte, gt } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, products, users, categories } from "@/db/schema";

/** Statuses that count as realised revenue. */
const REVENUE_STATUSES = ["confirmed", "fulfilled"] as const;

export interface AdminDashboardData {
  kpis: {
    totalRevenue: string;
    totalOrders: number;
    openQuotations: number;
    lowStockCount: number;
    inventoryValue: string;
    avgOrderValue: string;
    totalProducts: number;
    activeSellers: number;
  };
  revenueOverTime: { period: string; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; revenue: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  lowStock: {
    id: string;
    name: string;
    sku: string;
    dimension: string;
    baseUnit: string;
    stockBaseQty: string;
    lowStockThreshold: string;
    basePrice: string;
  }[];
  recentOrders: {
    id: string;
    total: string;
    status: string;
    type: string;
    createdAt: string;
    sellerName: string;
  }[];
}

type Row = Record<string, unknown>;

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const [
    revenueAgg,
    ordersCount,
    openQuotes,
    productAgg,
    sellersCount,
    revByWeek,
    byStatus,
    topProd,
    revByCat,
    lowStock,
    recent,
  ] = await Promise.all([
    // realised revenue + avg order value
    db
      .select({
        total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
        avg: sql<string>`COALESCE(AVG(${orders.total}), 0)`,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(inArray(orders.status, [...REVENUE_STATUSES])),
    db.select({ cnt: sql<number>`COUNT(*)` }).from(orders),
    db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(orders)
      .where(inArray(orders.status, ["pending", "quoted"])),
    // inventory value + product count
    db
      .select({
        value: sql<string>`COALESCE(SUM(${products.stockBaseQty} * ${products.basePrice}), 0)`,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(products),
    db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.role, "seller")),
    // revenue by ISO week
    db.execute(sql`
      SELECT to_char(date_trunc('week', ${orders.createdAt}), 'YYYY-MM-DD') AS period,
             COALESCE(SUM(${orders.total}), 0)::float8 AS revenue
      FROM ${orders}
      WHERE ${orders.status} IN ('confirmed','fulfilled')
      GROUP BY 1 ORDER BY 1
    `),
    // orders by status
    db
      .select({ status: orders.status, count: sql<number>`COUNT(*)` })
      .from(orders)
      .groupBy(orders.status),
    // top products by realised revenue
    db.execute(sql`
      SELECT ${orderItems.productName} AS name,
             COALESCE(SUM(${orderItems.lineTotal}), 0)::float8 AS revenue
      FROM ${orderItems}
      JOIN ${orders} ON ${orders.id} = ${orderItems.orderId}
      WHERE ${orders.status} IN ('confirmed','fulfilled')
      GROUP BY 1 ORDER BY revenue DESC LIMIT 6
    `),
    // revenue by category
    db.execute(sql`
      SELECT COALESCE(${categories.name}, 'Uncategorised') AS category,
             COALESCE(SUM(${orderItems.lineTotal}), 0)::float8 AS revenue
      FROM ${orderItems}
      JOIN ${orders} ON ${orders.id} = ${orderItems.orderId}
      JOIN ${products} ON ${products.id} = ${orderItems.productId}
      LEFT JOIN ${categories} ON ${categories.id} = ${products.categoryId}
      WHERE ${orders.status} IN ('confirmed','fulfilled')
      GROUP BY 1 ORDER BY revenue DESC
    `),
    // low stock products
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        dimension: products.dimension,
        baseUnit: products.baseUnit,
        stockBaseQty: products.stockBaseQty,
        lowStockThreshold: products.lowStockThreshold,
        basePrice: products.basePrice,
      })
      .from(products)
      .where(
        and(
          gt(products.lowStockThreshold, "0"),
          lte(products.stockBaseQty, products.lowStockThreshold)
        )
      )
      .orderBy(products.name),
    // recent orders with seller name
    db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        type: orders.type,
        createdAt: orders.createdAt,
        sellerName: users.name,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .orderBy(desc(orders.createdAt))
      .limit(6),
  ]);

  const asRows = (r: unknown): Row[] => r as unknown as Row[];

  return {
    kpis: {
      totalRevenue: String(revenueAgg[0]?.total ?? "0"),
      totalOrders: Number(ordersCount[0]?.cnt ?? 0),
      openQuotations: Number(openQuotes[0]?.cnt ?? 0),
      lowStockCount: lowStock.length,
      inventoryValue: String(productAgg[0]?.value ?? "0"),
      avgOrderValue: String(revenueAgg[0]?.avg ?? "0"),
      totalProducts: Number(productAgg[0]?.cnt ?? 0),
      activeSellers: Number(sellersCount[0]?.cnt ?? 0),
    },
    revenueOverTime: asRows(revByWeek).map((r) => ({
      period: String(r.period),
      revenue: Number(r.revenue),
    })),
    ordersByStatus: byStatus.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    topProducts: asRows(topProd).map((r) => ({
      name: String(r.name),
      revenue: Number(r.revenue),
    })),
    revenueByCategory: asRows(revByCat).map((r) => ({
      category: String(r.category),
      revenue: Number(r.revenue),
    })),
    lowStock: lowStock.map((p) => ({
      ...p,
    })),
    recentOrders: recent.map((o) => ({
      id: o.id,
      total: String(o.total),
      status: o.status,
      type: o.type,
      createdAt: o.createdAt.toISOString(),
      sellerName: o.sellerName,
    })),
  };
}

export interface SellerDashboardData {
  kpis: {
    totalSpend: string;
    totalOrders: number;
    openQuotations: number;
    lastStatus: string | null;
  };
  spendOverTime: { period: string; spend: number }[];
  ordersByStatus: { status: string; count: number }[];
}

export async function getSellerDashboard(
  userId: string
): Promise<SellerDashboardData> {
  const [spendAgg, ordersCount, openQuotes, last, spendByWeek, byStatus] =
    await Promise.all([
      db
        .select({ total: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            inArray(orders.status, [...REVENUE_STATUSES])
          )
        ),
      db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(orders)
        .where(eq(orders.userId, userId)),
      db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            inArray(orders.status, ["pending", "quoted"])
          )
        ),
      db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(1),
      db.execute(sql`
        SELECT to_char(date_trunc('week', ${orders.createdAt}), 'YYYY-MM-DD') AS period,
               COALESCE(SUM(${orders.total}), 0)::float8 AS spend
        FROM ${orders}
        WHERE ${orders.userId} = ${userId}
          AND ${orders.status} IN ('confirmed','fulfilled')
        GROUP BY 1 ORDER BY 1
      `),
      db
        .select({ status: orders.status, count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(eq(orders.userId, userId))
        .groupBy(orders.status),
    ]);

  const asRows = (r: unknown): Row[] => r as unknown as Row[];

  return {
    kpis: {
      totalSpend: String(spendAgg[0]?.total ?? "0"),
      totalOrders: Number(ordersCount[0]?.cnt ?? 0),
      openQuotations: Number(openQuotes[0]?.cnt ?? 0),
      lastStatus: last[0]?.status ?? null,
    },
    spendOverTime: asRows(spendByWeek).map((r) => ({
      period: String(r.period),
      spend: Number(r.spend),
    })),
    ordersByStatus: byStatus.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
  };
}
