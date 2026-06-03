"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PREFERRED_DISPLAY_UNIT,
  basePriceToDisplayUnit,
  formatINR,
  formatQty,
  fromBase,
  unitsForDimension,
  type Dimension,
} from "@/lib/units";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  dimension: Dimension;
  baseUnit: string;
  basePrice: string;
  stockBaseQty: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

type FormState = {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  dimension: Dimension;
  pricePerDisplayUnit: string;
  priceUnit: string;
  stockQty: string;
  stockUnit: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  dimension: "weight",
  pricePerDisplayUnit: "",
  priceUnit: "kg",
  stockQty: "",
  stockUnit: "kg",
  isActive: true,
};

export default function ProductManager({
  initialProducts,
  categories,
}: {
  initialProducts: ProductRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dimFilter, setDimFilter] = useState<"" | Dimension>("");
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialProducts.filter((p) => {
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesDim = !dimFilter || p.dimension === dimFilter;
      return matchesQ && matchesDim;
    });
  }, [initialProducts, query, dimFilter]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(p: ProductRow) {
    setEditing(p);
    setShowForm(true);
  }

  async function onDelete(p: ProductRow) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input max-w-[180px]"
          value={dimFilter}
          onChange={(e) => setDimFilter(e.target.value as "" | Dimension)}
        >
          <option value="">All dimensions</option>
          <option value="weight">Weight</option>
          <option value="volume">Volume</option>
          <option value="count">Count</option>
        </select>
        <button className="btn-primary ml-auto" onClick={openCreate}>
          + New product
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="table-th">SKU</th>
              <th className="table-th">Name</th>
              <th className="table-th">Dimension</th>
              <th className="table-th">Price</th>
              <th className="table-th">Stock</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const dispUnit = PREFERRED_DISPLAY_UNIT[p.dimension];
              const rate = basePriceToDisplayUnit(p.basePrice, dispUnit);
              const stock = fromBase(p.stockBaseQty, dispUnit);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs">{p.sku}</td>
                  <td className="table-td">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.category && (
                      <div className="text-xs text-slate-400">
                        {p.category.name}
                      </div>
                    )}
                  </td>
                  <td className="table-td capitalize">{p.dimension}</td>
                  <td className="table-td">
                    {formatINR(rate)}{" "}
                    <span className="text-slate-400">/ {dispUnit}</span>
                  </td>
                  <td className="table-td">{formatQty(stock, dispUnit)}</td>
                  <td className="table-td">
                    {p.isActive ? (
                      <span className="badge bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="table-td text-right">
                    <button
                      className="text-sm font-medium text-brand-600 hover:underline"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm font-medium text-red-600 hover:underline"
                      onClick={() => onDelete(p)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="table-td text-slate-400" colSpan={7}>
                  No products match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function toFormState(product: ProductRow | null): FormState {
  if (!product) return { ...EMPTY_FORM };
  const dispUnit = PREFERRED_DISPLAY_UNIT[product.dimension];
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    dimension: product.dimension,
    pricePerDisplayUnit: basePriceToDisplayUnit(
      product.basePrice,
      dispUnit
    ).toString(),
    priceUnit: dispUnit,
    stockQty: fromBase(product.stockBaseQty, dispUnit).toString(),
    stockUnit: dispUnit,
    isActive: product.isActive,
  };
}

function ProductForm({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: ProductRow | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dimUnits = unitsForDimension(form.dimension);

  function setDimension(dim: Dimension) {
    const def = PREFERRED_DISPLAY_UNIT[dim];
    setForm((f) => ({ ...f, dimension: dim, priceUnit: def, stockUnit: def }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        description: form.description || "",
      };
      const res = await fetch(
        product ? `/api/products/${product.id}` : "/api/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {product ? "Edit product" : "New product"}
        </h2>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SKU</label>
              <input
                className="input"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div>
            <label className="label">Dimension</label>
            <select
              className="input"
              value={form.dimension}
              onChange={(e) => setDimension(e.target.value as Dimension)}
            >
              <option value="weight">Weight (base: g)</option>
              <option value="volume">Volume (base: mL)</option>
              <option value="count">Count (base: item)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (INR)</label>
              <input
                className="input"
                inputMode="decimal"
                value={form.pricePerDisplayUnit}
                onChange={(e) =>
                  setForm({ ...form, pricePerDisplayUnit: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label">per unit</label>
              <select
                className="input"
                value={form.priceUnit}
                onChange={(e) =>
                  setForm({ ...form, priceUnit: e.target.value })
                }
              >
                {dimUnits.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Stock quantity</label>
              <input
                className="input"
                inputMode="decimal"
                value={form.stockQty}
                onChange={(e) =>
                  setForm({ ...form, stockQty: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label">stock unit</label>
              <select
                className="input"
                value={form.stockUnit}
                onChange={(e) =>
                  setForm({ ...form, stockUnit: e.target.value })
                }
              >
                {dimUnits.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.checked })
              }
            />
            Active (visible to sellers)
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
