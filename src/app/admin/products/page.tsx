import { desc } from "drizzle-orm";
import { db } from "@/db";
import { products as productsTable, categories as categoriesTable } from "@/db/schema";
import ProductManager from "./product-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    db.query.products.findMany({
      orderBy: desc(productsTable.createdAt),
      with: { category: true },
    }),
    db.select().from(categoriesTable).orderBy(categoriesTable.name),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <p className="text-sm text-slate-500">
          Create, edit, and configure base units &amp; prices.
        </p>
      </div>
      <ProductManager
        initialProducts={JSON.parse(JSON.stringify(products))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
