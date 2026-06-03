import { Decimal } from "decimal.js";

/**
 * Unit & conversion strategy
 * ==========================
 * Every product belongs to exactly one *dimension*. Each dimension defines a
 * single canonical BASE UNIT in which all quantities for that product are
 * stored in the database:
 *
 *   weight  -> gram (g)
 *   volume  -> millilitre (mL)
 *   count   -> item
 *
 * A unit's `factorToBase` converts a quantity expressed in that unit into the
 * base unit:   base_qty = qty * factorToBase
 *
 *   1 kg = 1000 g   -> factorToBase(kg) = 1000
 *   1 L  = 1000 mL  -> factorToBase(L)  = 1000
 *
 * Prices are stored as `basePrice` = INR per ONE base unit (e.g. INR/gram).
 * Line total = baseQty * basePrice, computed with decimal.js and rounded to
 * 2 dp (paise) only at the money boundary.
 *
 * This module is the single source of truth for the unit catalogue and all
 * conversion math, so the same logic runs in the seed script, the API layer,
 * and the UI.
 */

// Configure decimal.js for finance-grade precision.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Dimension = "weight" | "volume" | "count";

export interface UnitDef {
  code: string;
  label: string;
  dimension: Dimension;
  /** Multiply a quantity in this unit by this to get the base unit. */
  factorToBase: string;
}

/** The canonical base unit for each dimension. */
export const BASE_UNIT: Record<Dimension, string> = {
  weight: "g",
  volume: "mL",
  count: "item",
};

/** Master catalogue of supported units. Seeded into the `units` table. */
export const UNITS: UnitDef[] = [
  { code: "g", label: "Grams (g)", dimension: "weight", factorToBase: "1" },
  { code: "kg", label: "Kilograms (kg)", dimension: "weight", factorToBase: "1000" },
  { code: "mL", label: "Millilitres (mL)", dimension: "volume", factorToBase: "1" },
  { code: "L", label: "Litres (L)", dimension: "volume", factorToBase: "1000" },
  { code: "item", label: "Items (count)", dimension: "count", factorToBase: "1" },
];

const UNIT_BY_CODE = new Map(UNITS.map((u) => [u.code, u]));

export function getUnit(code: string): UnitDef {
  const u = UNIT_BY_CODE.get(code);
  if (!u) throw new Error(`Unknown unit: ${code}`);
  return u;
}

/** All units that belong to the given dimension (valid order/display units). */
export function unitsForDimension(dimension: Dimension): UnitDef[] {
  return UNITS.filter((u) => u.dimension === dimension);
}

/** Convert a quantity from `unitCode` into the dimension's base unit. */
export function toBase(qty: Decimal.Value, unitCode: string): Decimal {
  const unit = getUnit(unitCode);
  return new Decimal(qty).mul(unit.factorToBase);
}

/** Convert a base-unit quantity into `unitCode`. */
export function fromBase(baseQty: Decimal.Value, unitCode: string): Decimal {
  const unit = getUnit(unitCode);
  return new Decimal(baseQty).div(unit.factorToBase);
}

/**
 * Compute a line total in INR.
 * @param orderedQty quantity as entered by the user
 * @param orderedUnit the unit the user entered (must match product dimension)
 * @param basePricePerBaseUnit INR per one base unit (product.basePrice)
 * @returns { baseQty, lineTotal } both as Decimal; caller serialises to string.
 */
export function calcLineTotal(
  orderedQty: Decimal.Value,
  orderedUnit: string,
  basePricePerBaseUnit: Decimal.Value
): { baseQty: Decimal; lineTotal: Decimal } {
  const baseQty = toBase(orderedQty, orderedUnit);
  const lineTotal = baseQty.mul(basePricePerBaseUnit).toDecimalPlaces(2);
  return { baseQty, lineTotal };
}

/**
 * Convert a price expressed per a chosen DISPLAY unit into price per BASE unit.
 * Used by the admin product form: admin types "₹500 per kg" and we store the
 * equivalent INR-per-gram so all downstream math is uniform.
 *   pricePerBase = pricePerDisplayUnit / factorToBase(displayUnit)
 */
export function pricePerDisplayUnitToBase(
  pricePerDisplayUnit: Decimal.Value,
  displayUnit: string
): Decimal {
  const unit = getUnit(displayUnit);
  return new Decimal(pricePerDisplayUnit).div(unit.factorToBase);
}

/** Inverse of the above — for showing a friendly per-unit rate in the UI. */
export function basePriceToDisplayUnit(
  basePrice: Decimal.Value,
  displayUnit: string
): Decimal {
  const unit = getUnit(displayUnit);
  return new Decimal(basePrice).mul(unit.factorToBase);
}

/** Format a number as INR currency for the UI. */
export function formatINR(value: Decimal.Value): string {
  const n = new Decimal(value).toDecimalPlaces(2).toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format a quantity with its unit, trimming trailing zeros. */
export function formatQty(value: Decimal.Value, unitCode: string): string {
  const d = new Decimal(value);
  // Show up to 6 dp but strip trailing zeros for readability.
  const str = d.toDecimalPlaces(6).toString();
  return `${str} ${unitCode}`;
}
