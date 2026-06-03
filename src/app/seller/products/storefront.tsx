"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Decimal } from "decimal.js";
import {
  PREFERRED_DISPLAY_UNIT,
  basePriceToDisplayUnit,
  calcLineTotal,
  formatINR,
  formatQty,
  fromBase,
  toBase,
  unitsForDimension,
  type Dimension,
} from "@/lib/units";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  dimension: Dimension;
  baseUnit: string;
  basePrice: string;
  stockBaseQty: string;
  category: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface CartLine {
  product: ProductRow;
  qty: string;
  unit: string;
}

export default function StoreFront({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dimFilter, setDimFilter] = useState<"" | Dimension>("");
  const [catFilter, setCatFilter] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [type, setType] = useState<"quotation" | "order">("quotation");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesDim = !dimFilter || p.dimension === dimFilter;
      const matchesCat = !catFilter || p.category?.id === catFilter;
      return matchesQ && matchesDim && matchesCat;
    });
  }, [products, query, dimFilter, catFilter]);

  function addToCart(product: ProductRow, qty: string, unit: string) {
    setCart((c) => ({ ...c, [product.id]: { product, qty, unit } }));
    setDone(null);
  }

  function removeFromCart(id: string) {
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }

  function updateCart(id: string, patch: Partial<CartLine>) {
    setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  }

  const cartLines = Object.values(cart);
  const grandTotal = cartLines.reduce((acc, line) => {
    try {
      const { lineTotal } = calcLineTotal(
        line.qty || "0",
        line.unit,
        line.product.basePrice
      );
      return acc.add(lineTotal);
    } catch {
      return acc;
    }
  }, new Decimal(0));

  async function placeOrder() {
    setSubmitting(true);
    setDone(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          note,
          items: cartLines.map((l) => ({
            productId: l.product.id,
            orderedQty: l.qty,
            orderedUnit: l.unit,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to place order");
        return;
      }
      setCart({});
      setNote("");
      setDone(
        `${type === "order" ? "Order" : "Quotation"} placed! View it under "My Orders".`
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Catalogue */}
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search name or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input max-w-[160px]"
            value={dimFilter}
            onChange={(e) => setDimFilter(e.target.value as "" | Dimension)}
          >
            <option value="">All dimensions</option>
            <option value="weight">Weight</option>
            <option value="volume">Volume</option>
            <option value="count">Count</option>
          </select>
          <select
            className="input max-w-[200px]"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              inCart={cart[p.id]}
              onAdd={addToCart}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-slate-400">
              No products match your search.
            </div>
          )}
        </div>
      </div>

      {/* Cart / quotation builder */}
      <div className="lg:col-span-1">
        <div className="card sticky top-6 p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Your {type === "order" ? "order" : "quotation"}
          </h2>

          {done && (
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {done}
            </div>
          )}

          {cartLines.length === 0 ? (
            <p className="text-sm text-slate-400">
              No items yet. Add products from the left.
            </p>
          ) : (
            <div className="space-y-3">
              {cartLines.map((line) => {
                let lineTotal = "—";
                try {
                  lineTotal = formatINR(
                    calcLineTotal(
                      line.qty || "0",
                      line.unit,
                      line.product.basePrice
                    ).lineTotal
                  );
                } catch {
                  /* invalid qty */
                }
                return (
                  <div
                    key={line.product.id}
                    className="rounded-md border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-medium text-slate-800">
                        {line.product.name}
                      </div>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeFromCart(line.product.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="input flex-1"
                        inputMode="decimal"
                        value={line.qty}
                        onChange={(e) =>
                          updateCart(line.product.id, { qty: e.target.value })
                        }
                      />
                      <select
                        className="input max-w-[90px]"
                        value={line.unit}
                        onChange={(e) =>
                          updateCart(line.product.id, { unit: e.target.value })
                        }
                      >
                        {unitsForDimension(line.product.dimension).map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-1 text-right text-sm font-semibold text-slate-900">
                      {lineTotal}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatINR(grandTotal)}
                </span>
              </div>

              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "quotation" | "order")
                  }
                >
                  <option value="quotation">Quotation (request a quote)</option>
                  <option value="order">Order (place an order)</option>
                </select>
              </div>

              <div>
                <label className="label">Note (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Delivery timeline, special instructions…"
                />
              </div>

              <button
                className="btn-primary w-full"
                onClick={placeOrder}
                disabled={submitting}
              >
                {submitting
                  ? "Submitting…"
                  : `Place ${type === "order" ? "order" : "quotation"}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A single catalogue row with an inline live-price calculator. */
function ProductCard({
  product,
  inCart,
  onAdd,
}: {
  product: ProductRow;
  inCart?: CartLine;
  onAdd: (p: ProductRow, qty: string, unit: string) => void;
}) {
  const dispUnit = PREFERRED_DISPLAY_UNIT[product.dimension];
  const rate = basePriceToDisplayUnit(product.basePrice, dispUnit);
  const stock = fromBase(product.stockBaseQty, dispUnit);
  const units = unitsForDimension(product.dimension);

  const [qty, setQty] = useState(inCart?.qty ?? "1");
  const [unit, setUnit] = useState(inCart?.unit ?? dispUnit);

  let preview = "—";
  let overStock = false;
  try {
    preview = formatINR(calcLineTotal(qty || "0", unit, product.basePrice).lineTotal);
    overStock = toBase(qty || "0", unit).greaterThan(
      new Decimal(product.stockBaseQty)
    );
  } catch {
    /* invalid */
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{product.name}</div>
          <div className="font-mono text-xs text-slate-400">{product.sku}</div>
          {product.description && (
            <p className="mt-1 text-sm text-slate-500">{product.description}</p>
          )}
          <div className="mt-1 text-xs text-slate-400">
            {product.category?.name ?? "Uncategorised"} · In stock:{" "}
            {formatQty(stock, dispUnit)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-slate-900">{formatINR(rate)}</div>
          <div className="text-xs text-slate-400">per {dispUnit}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <div>
          <label className="label">Qty</label>
          <input
            className="input w-24"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Unit</label>
          <select
            className="input w-24"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">Line price</div>
          <div className="text-lg font-bold text-slate-900">{preview}</div>
        </div>
        <button
          className={inCart ? "btn-secondary" : "btn-primary"}
          onClick={() => onAdd(product, qty, unit)}
        >
          {inCart ? "Update" : "Add"}
        </button>
      </div>
      {overStock && (
        <p className="mt-2 text-xs font-medium text-amber-600">
          ⚠ Requested quantity exceeds available stock ({formatQty(stock, dispUnit)}).
        </p>
      )}
    </div>
  );
}
