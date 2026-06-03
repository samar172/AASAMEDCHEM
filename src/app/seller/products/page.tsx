import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products as productsTable, categories as categoriesTable } from "@/db/schema";
import StoreFront from "./storefront";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const [products, categories] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(productsTable.isActive, true)),
      orderBy: asc(productsTable.name),
      with: { category: true },
    }),
    db.select().from(categoriesTable).orderBy(categoriesTable.name),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Browse Products</h1>
        <p className="text-sm text-slate-500">
          Search, pick a unit, see the live INR price, and build a quotation.
        </p>
      </div>
      <StoreFront
        products={JSON.parse(JSON.stringify(products))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
