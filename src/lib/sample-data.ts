import { hashSeed, mulberry32 } from "../utils/deterministic";
import { fromISODate, isoDaysBefore, toISODate } from "../utils/date";

/**
 * Sample chain-store dataset for version 1.
 *
 * Hand-curated catalog (realistic names/prices) with deterministically
 * generated sales and inventory so every environment shows the same demo.
 * Generated only by the Convex seed function; see src/convex/seed.ts.
 */

export const SALES_DAYS = 84; // twelve weeks of history
export const SAMPLE_SEED = 7;

export interface SampleStore {
  code: string;
  name: string;
  city: string;
}

export interface SampleProduct {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  reorderPoint: number;
}

export interface SampleDailySales {
  date: string;
  unitsSold: number;
  revenue: number;
}

export interface SampleInventoryItem {
  onHand: number;
  reserved: number;
}

export const SAMPLE_STORES: SampleStore[] = [
  { code: "DTC-01", name: "Downtown Flagship", city: "Lisbon" },
  { code: "RIV-02", name: "Riverside Market", city: "Porto" },
  { code: "NSH-03", name: "Northshore Plaza", city: "Braga" },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { sku: "CB-ESP-250", name: "Espresso Blend 250g", category: "Coffee", unitPrice: 12.5, reorderPoint: 24 },
  { sku: "CB-FIL-250", name: "House Filter 250g", category: "Coffee", unitPrice: 9.8, reorderPoint: 18 },
  { sku: "CB-SIN-1KG", name: "Single Origin 1kg", category: "Coffee", unitPrice: 34.0, reorderPoint: 10 },
  { sku: "AC-CUP-12", name: "Ceramic Cup (12-pack)", category: "Accessories", unitPrice: 48.0, reorderPoint: 6 },
  { sku: "AC-KET-01", name: "Pour-over Kettle", category: "Accessories", unitPrice: 65.0, reorderPoint: 4 },
  { sku: "AC-SCL-01", name: "Brew Scale", category: "Accessories", unitPrice: 89.0, reorderPoint: 3 },
  { sku: "SN-MUG-01", name: "Diner Mug", category: "Merch", unitPrice: 14.0, reorderPoint: 12 },
  { sku: "SN-TEE-02", name: "Crew T-shirt", category: "Merch", unitPrice: 22.0, reorderPoint: 10 },
  { sku: "SN-TEE-03", name: "Logo Hoodie", category: "Merch", unitPrice: 45.0, reorderPoint: 8 },
  { sku: "SN-TOT-01", name: "Canvas Tote", category: "Merch", unitPrice: 18.0, reorderPoint: 14 },
  { sku: "FD-COK-12", name: "Cookie Box (12-pack)", category: "Food", unitPrice: 21.0, reorderPoint: 20 },
  { sku: "FD-GRN-08", name: "Granola Bag 400g", category: "Food", unitPrice: 7.5, reorderPoint: 26 },
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
};

function storeScaleFor(code: string): number {
  return STORE_SCALE[code] ?? 1;
}

/** Per-product demand profile: base velocity plus weekday/weekend swing. */
export interface DemandProfile {
  avgDailyUnits: number;
  weekdayFactor: number;
  weekendFactor: number;
}

export const DEMAND_PROFILES: Record<string, DemandProfile> = {
  "CB-ESP-250": { avgDailyUnits: 9.5, weekdayFactor: 0.9, weekendFactor: 1.35 },
  "CB-FIL-250": { avgDailyUnits: 7.0, weekdayFactor: 0.95, weekendFactor: 1.2 },
  "CB-SIN-1KG": { avgDailyUnits: 2.6, weekdayFactor: 1.0, weekendFactor: 1.1 },
  "AC-CUP-12": { avgDailyUnits: 0.9, weekdayFactor: 1.0, weekendFactor: 1.3 },
  "AC-KET-01": { avgDailyUnits: 0.5, weekdayFactor: 1.0, weekendFactor: 1.4 },
  "AC-SCL-01": { avgDailyUnits: 0.4, weekdayFactor: 1.0, weekendFactor: 1.3 },
  "SN-MUG-01": { avgDailyUnits: 2.2, weekdayFactor: 0.9, weekendFactor: 1.4 },
  "SN-TEE-02": { avgDailyUnits: 1.6, weekdayFactor: 0.9, weekendFactor: 1.5 },
  "SN-TEE-03": { avgDailyUnits: 1.1, weekdayFactor: 0.9, weekendFactor: 1.5 },
  "SN-TOT-01": { avgDailyUnits: 1.4, weekdayFactor: 0.95, weekendFactor: 1.3 },
  "FD-COK-12": { avgDailyUnits: 5.5, weekdayFactor: 0.85, weekendFactor: 1.45 },
  "FD-GRN-08": { avgDailyUnits: 4.2, weekdayFactor: 1.0, weekendFactor: 1.1 },
};

export function demandProfileFor(sku: string): DemandProfile {
  return (
    DEMAND_PROFILES[sku] ?? {
      avgDailyUnits: 2,
      weekdayFactor: 1,
      weekendFactor: 1,
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
  const rng = mulberry32(hashSeed(`${storeCode}:${sku}:sales`));
  const rows: SampleDailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDaysBefore(endDate, i);
    const weekday = fromISODate(date).getDay(); // 0 = Sunday
    const weekend = weekday === 0 || weekday === 5 || weekday === 6;
    const factor = weekend ? profile.weekendFactor : profile.weekdayFactor;
    const noise = 0.75 + rng() * 0.5;
    const units = Math.max(
      0,
      Math.round(profile.avgDailyUnits * scale * factor * noise),
    );
    rows.push({ date, unitsSold: units, revenue: round2(units * unitPrice) });
  }
  return rows;
}

/**
 * Deterministic stock position for one store+product. Roughly 8% of rows
 * are stocked out and ~14% sit below their reorder point, so the demo
 * dashboard shows both healthy and attention-needed items.
 */
export function generateInventory(
  storeCode: string,
  sku: string,
  reorderPoint: number,
): SampleInventoryItem {
  const rng = mulberry32(hashSeed(`${storeCode}:${sku}:stock`));
  const roll = rng();
  if (roll < 0.08) {
    return { onHand: 0, reserved: rng() < 0.3 ? 2 : 0 };
  }
  if (roll < 0.22) {
    const low = Math.floor(reorderPoint * (0.15 + rng() * 0.6));
    const onHand = Math.max(1, low);
    return { onHand, reserved: Math.min(onHand, Math.round(rng() * 2)) };
  }
  const onHand = Math.round(reorderPoint * (1.5 + rng() * 2.5));
  const reserved = Math.min(
    onHand,
    Math.round(rng() * Math.max(1, reorderPoint * 0.1)),
  );
  return { onHand, reserved };
}

/** Re-exported for convenience: ISO day key for "now". */
export function todayKey(now: Date = new Date()): string {
  return toISODate(now);
}
