import { hashSeed, mulberry32 } from "../utils/deterministic";
import { fromISODate, isoDaysBefore, toISODate } from "../utils/date";

/**
 * Sample chain-store dataset.
 *
 * Hand-curated catalog (realistic names/prices) with deterministically
 * generated sales and inventory so every environment shows the same demo.
 * Sales cover ~6 months (SALES_DAYS) with weekly rhythm, a mild seasonal
 * wave and per-product trend drift, so the history tells a believable
 * business story: some products growing, some declining, some flat.
 *
 * Generated only by the Convex seed function; see src/convex/seed.ts.
 */

export const SALES_DAYS = 182; // ~6 months of history
export const SAMPLE_SEED = 7;

export interface SampleStore {
  code: string;
  name: string;
  city: string;
  status: "active" | "opening";
  createdAt: string;
}

export interface SampleProduct {
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  unitCost: number;
  reorderPoint: number;
  active: boolean;
}

export interface SampleDailySales {
  date: string;
  unitsSold: number;
  revenue: number;
}

export interface SampleInventoryItem {
  onHand: number;
  reserved: number;
  safetyStock: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------

export const SAMPLE_STORES: SampleStore[] = [
  {
    code: "DTC-01",
    name: "Downtown Flagship",
    city: "Lisbon",
    status: "active",
    createdAt: "2025-02-03T09:00:00.000Z",
  },
  {
    code: "RIV-02",
    name: "Riverside Market",
    city: "Porto",
    status: "active",
    createdAt: "2025-03-17T09:00:00.000Z",
  },
  {
    code: "NSH-03",
    name: "Northshore Plaza",
    city: "Braga",
    status: "active",
    createdAt: "2025-05-05T09:00:00.000Z",
  },
  {
    code: "HRB-04",
    name: "Harborside Kiosk",
    city: "Faro",
    status: "opening",
    createdAt: "2026-08-24T09:00:00.000Z",
  },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { sku: "CB-ESP-250", name: "Espresso Blend 250g", category: "Coffee", unit: "bag", unitPrice: 12.5, unitCost: 6.9, reorderPoint: 24, active: true },
  { sku: "CB-FIL-250", name: "House Filter 250g", category: "Coffee", unit: "bag", unitPrice: 9.8, unitCost: 5.4, reorderPoint: 18, active: true },
  { sku: "CB-SIN-1KG", name: "Single Origin 1kg", category: "Coffee", unit: "bag", unitPrice: 34.0, unitCost: 19.2, reorderPoint: 10, active: true },
  { sku: "CB-DEC-250", name: "Decaf Reserve 250g", category: "Coffee", unit: "bag", unitPrice: 11.2, unitCost: 6.3, reorderPoint: 12, active: true },
  { sku: "AC-CUP-12", name: "Ceramic Cup (12-pack)", category: "Accessories", unit: "pack", unitPrice: 48.0, unitCost: 27.5, reorderPoint: 6, active: true },
  { sku: "AC-KET-01", name: "Pour-over Kettle", category: "Accessories", unit: "piece", unitPrice: 65.0, unitCost: 38.0, reorderPoint: 4, active: true },
  { sku: "AC-SCL-01", name: "Brew Scale", category: "Accessories", unit: "piece", unitPrice: 89.0, unitCost: 52.0, reorderPoint: 3, active: true },
  { sku: "AC-GRD-01", name: "Hand Grinder Pro", category: "Accessories", unit: "piece", unitPrice: 112.0, unitCost: 64.0, reorderPoint: 4, active: true },
  { sku: "SN-MUG-01", name: "Diner Mug", category: "Merch", unit: "piece", unitPrice: 14.0, unitCost: 7.2, reorderPoint: 12, active: true },
  { sku: "SN-TEE-02", name: "Crew T-shirt", category: "Merch", unit: "piece", unitPrice: 22.0, unitCost: 11.0, reorderPoint: 10, active: true },
  { sku: "SN-TEE-03", name: "Logo Hoodie", category: "Merch", unit: "piece", unitPrice: 45.0, unitCost: 24.5, reorderPoint: 8, active: true },
  { sku: "FD-COK-12", name: "Cookie Box (12-pack)", category: "Food", unit: "box", unitPrice: 21.0, unitCost: 11.5, reorderPoint: 20, active: true },
  { sku: "FD-GRN-08", name: "Granola Bag 400g", category: "Food", unit: "bag", unitPrice: 7.5, unitCost: 3.9, reorderPoint: 26, active: true },
  { sku: "FD-CHC-08", name: "Cold Brew Concentrate", category: "Food", unit: "bottle", unitPrice: 9.0, unitCost: 4.6, reorderPoint: 22, active: true },
];

// ---------------------------------------------------------------------------
// Deterministic generators
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Relative store size; multiplies product demand. */
const STORE_SCALE: Record<string, number> = {
  "DTC-01": 1.25,
  "RIV-02": 1.0,
  "NSH-03": 0.7,
  "HRB-04": 0,
};

function storeScaleFor(code: string): number {
  return STORE_SCALE[code] ?? 1;
}

/** Per-product demand profile: base velocity, weekly swing, trend drift. */
export interface DemandProfile {
  avgDailyUnits: number;
  weekdayFactor: number;
  weekendFactor: number;
  /** Units/day drift over the whole history window (negative = declining). */
  trendPerDay: number;
}

export const DEMAND_PROFILES: Record<string, DemandProfile> = {
  "CB-ESP-250": { avgDailyUnits: 9.0, weekdayFactor: 0.9, weekendFactor: 1.35, trendPerDay: 0.012 },
  "CB-FIL-250": { avgDailyUnits: 6.8, weekdayFactor: 0.95, weekendFactor: 1.2, trendPerDay: 0.004 },
  "CB-SIN-1KG": { avgDailyUnits: 2.4, weekdayFactor: 1.0, weekendFactor: 1.1, trendPerDay: 0.009 },
  "CB-DEC-250": { avgDailyUnits: 2.9, weekdayFactor: 0.95, weekendFactor: 1.15, trendPerDay: 0.016 },
  "AC-CUP-12": { avgDailyUnits: 0.9, weekdayFactor: 1.0, weekendFactor: 1.3, trendPerDay: -0.002 },
  "AC-KET-01": { avgDailyUnits: 0.5, weekdayFactor: 1.0, weekendFactor: 1.4, trendPerDay: 0.0 },
  "AC-SCL-01": { avgDailyUnits: 0.4, weekdayFactor: 1.0, weekendFactor: 1.3, trendPerDay: -0.004 },
  "AC-GRD-01": { avgDailyUnits: 0.7, weekdayFactor: 1.0, weekendFactor: 1.25, trendPerDay: 0.011 },
  "SN-MUG-01": { avgDailyUnits: 2.1, weekdayFactor: 0.9, weekendFactor: 1.4, trendPerDay: -0.008 },
  "SN-TEE-02": { avgDailyUnits: 1.5, weekdayFactor: 0.9, weekendFactor: 1.5, trendPerDay: -0.006 },
  "SN-TEE-03": { avgDailyUnits: 1.1, weekdayFactor: 0.9, weekendFactor: 1.5, trendPerDay: 0.003 },
  "FD-COK-12": { avgDailyUnits: 5.2, weekdayFactor: 0.85, weekendFactor: 1.45, trendPerDay: -0.014 },
  "FD-GRN-08": { avgDailyUnits: 4.0, weekdayFactor: 1.0, weekendFactor: 1.1, trendPerDay: 0.002 },
  "FD-CHC-08": { avgDailyUnits: 3.3, weekdayFactor: 0.95, weekendFactor: 1.3, trendPerDay: 0.018 },
};

export function demandProfileFor(sku: string): DemandProfile {
  return (
    DEMAND_PROFILES[sku] ?? {
      avgDailyUnits: 2,
      weekdayFactor: 1,
      weekendFactor: 1,
      trendPerDay: 0,
    }
  );
}

/**
 * Deterministic daily sales rows (oldest first) for one store+product.
 * The PRNG is seeded from store+sku, so the series is stable across runs;
 * only the trailing date shifts with the current day.
 */
export function generateDailySales(
  storeCode: string,
  sku: string,
  unitPrice: number,
  endDate: Date,
  days: number = SALES_DAYS,
): SampleDailySales[] {
  const profile = demandProfileFor(sku);
  const scale = storeScaleFor(storeCode);
  if (scale === 0) return []; // opening stores have no sales yet
  const rng = mulberry32(hashSeed(`${storeCode}:${sku}:sales`));
  const rows: SampleDailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDaysBefore(endDate, i);
    const dayIndex = days - 1 - i; // 0 = oldest day
    const weekday = fromISODate(date).getDay(); // 0 = Sunday
    const weekend = weekday === 0 || weekday === 5 || weekday === 6;
    const factor = weekend ? profile.weekendFactor : profile.weekdayFactor;
    // Mild quarterly seasonal wave (~±8%) + linear trend drift + noise.
    const seasonal = 1 + 0.08 * Math.sin((2 * Math.PI * dayIndex) / 91);
    const trend = 1 + (profile.trendPerDay * dayIndex) / Math.max(0.5, profile.avgDailyUnits);
    const noise = 0.75 + rng() * 0.5;
    const units = Math.max(
      0,
      Math.round(profile.avgDailyUnits * scale * factor * seasonal * trend * noise),
    );
    rows.push({ date, unitsSold: units, revenue: round2(units * unitPrice) });
  }
  return rows;
}

/**
 * Deterministic stock position for one store+product. Roughly 7% of rows
 * are stocked out, ~15% sit below their reorder point (critical or low)
 * and ~8% are overstocked, so the demo shows all four health states.
 */
export function generateInventory(
  storeCode: string,
  sku: string,
  reorderPoint: number,
): SampleInventoryItem {
  const rng = mulberry32(hashSeed(`${storeCode}:${sku}:stock`));
  const roll = rng();
  const updatedAt = Date.now() - Math.floor(rng() * 36) * 3_600_000;

  if (roll < 0.07) {
    // Stocked out
    return { onHand: 0, reserved: rng() < 0.3 ? 2 : 0, safetyStock: Math.round(reorderPoint * 0.25), updatedAt };
  }
  if (roll < 0.15) {
    // Critical: well below half the reorder point
    const onHand = Math.max(1, Math.floor(reorderPoint * (0.1 + rng() * 0.3)));
    return { onHand, reserved: Math.min(onHand, Math.round(rng() * 2)), safetyStock: Math.round(reorderPoint * 0.25), updatedAt };
  }
  if (roll < 0.22) {
    // Low: below the reorder point but above critical
    const onHand = Math.max(1, Math.floor(reorderPoint * (0.5 + rng() * 0.45)));
    return { onHand, reserved: Math.min(onHand, Math.round(rng() * 2)), safetyStock: Math.round(reorderPoint * 0.25), updatedAt };
  }
  if (roll < 0.3) {
    // Overstocked: capital sitting on the shelf
    const onHand = Math.round(reorderPoint * (3.2 + rng() * 1.8));
    return { onHand, reserved: Math.min(onHand, Math.round(rng() * 2)), safetyStock: Math.round(reorderPoint * 0.25), updatedAt };
  }
  // Healthy
  const onHand = Math.round(reorderPoint * (1.2 + rng() * 1.4));
  return {
    onHand,
    reserved: Math.min(onHand, Math.round(rng() * Math.max(1, reorderPoint * 0.1))),
    safetyStock: Math.round(reorderPoint * 0.25),
    updatedAt,
  };
}

/** Re-exported for convenience: ISO day key for "now". */
export function todayKey(now: Date = new Date()): string {
  return toISODate(now);
}
