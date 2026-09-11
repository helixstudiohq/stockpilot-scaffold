import { avgDailyDemand, trendPerDay } from "./forecasting";

/**
 * Inventory-status classification and reorder engine.
 *
 * The reorder formula is the classical target-stock approach and is stated
 * explicitly so the UI can show the reason behind every recommendation:
 *
 *   target = forecast lead-time demand + safety stock
 *   recommended = max(0, target - available stock)
 *
 * Safety stock uses the z-score of a service level × demand std-dev × √LT,
 * the standard formulation — not an arbitrary constant.
 */

export type StockStatus = "out" | "critical" | "low" | "healthy" | "overstocked";

export interface StockContext {
  currentStock: number;
  reserved: number;
  reorderPoint: number;
  safetyStock: number;
  /** Average daily demand over the trailing window (units/day). */
  avgDaily: number;
}

export const STATUS_RANK: Record<StockStatus, number> = {
  out: 0,
  critical: 1,
  low: 2,
  healthy: 3,
  overstocked: 4,
};

/** Priority label for reorder urgency — derived from the stock status. */
export type ReorderPriority = "critical" | "high" | "medium" | "low";

export const PRIORITY_RANK: Record<ReorderPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function availableStock({ currentStock, reserved }: StockContext): number {
  return Math.max(0, currentStock - reserved);
}

/**
 * Four-state classification (plus explicit "out" for zero sellable stock):
 *  - out        no sellable units at all
 *  - critical   available ≤ 50% of the reorder point
 *  - low        available ≤ reorder point
 *  - overstocked available > 3× reorder point (capital sitting on the shelf)
 *  - healthy    everything else
 */
export function stockStatus(ctx: StockContext): StockStatus {
  const available = availableStock(ctx);
  if (available <= 0) return "out";
  const floor = Math.max(1, ctx.reorderPoint * 0.5);
  if (available <= floor) return "critical";
  if (available <= ctx.reorderPoint) return "low";
  if (available > ctx.reorderPoint * 3) return "overstocked";
  return "healthy";
}

export function stockStatusRank(status: StockStatus): number {
  return STATUS_RANK[status];
}

/** Days of demand the current sellable stock can cover. */
export function daysOfCover(ctx: StockContext): number {
  const available = availableStock(ctx);
  if (ctx.avgDaily <= 0) return available > 0 ? Infinity : 0;
  return available / ctx.avgDaily;
}

/** How far below the reorder point we currently are (0 when at/above it). */
export function shortfallUnits(ctx: StockContext): number {
  return Math.max(0, ctx.reorderPoint - availableStock(ctx));
}

// ---------------------------------------------------------------------------
// Reorder engine
// ---------------------------------------------------------------------------

export const LEAD_TIME_DAYS = 7;
export const SERVICE_LEVEL = 0.95;
/** z-score for the configured two-sided service level (≈ 1.65 for 95%). */
export const SERVICE_Z = 1.65;

export interface ReorderInput extends StockContext {
  /** Daily demand history, oldest first (units/day). */
  demandHistory: number[];
  /** Forecast lead-time demand; defaults to avgDaily × lead time. */
  leadTimeDemand?: number;
  unitCost: number;
}

export interface ReorderRecommendation {
  recommendedQty: number;
  leadTimeDemand: number;
  safetyStock: number;
  targetStock: number;
  daysOfCover: number;
  priority: ReorderPriority;
  status: StockStatus;
  estimatedCost: number;
  /** Human-readable rationale rendered verbatim in the UI. */
  reason: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avgDailyDemand(values, values.length);
  const variance =
    values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Safety stock for the lead time: z × σ_daily × √LT, floored at zero and
 * rounded to whole units. Uses the trailing 28 days of demand.
 */
export function safetyStockFor(demandHistory: number[]): number {
  const sigma = stdDev(demandHistory.slice(-28));
  return Math.max(0, Math.round(SERVICE_Z * sigma * Math.sqrt(LEAD_TIME_DAYS)));
}

/**
 * Full reorder computation for one store–product position.
 * Pure: same inputs always produce the same recommendation.
 */
export function recommendReorder(input: ReorderInput): ReorderRecommendation {
  const {
    currentStock,
    reserved,
    reorderPoint,
    demandHistory,
    unitCost,
  } = input;

  const avgDaily = avgDailyDemand(demandHistory, 14);
  const status = stockStatus({
    currentStock,
    reserved,
    reorderPoint,
    safetyStock: 0,
    avgDaily,
  });

  const leadTimeDemand = round2(
    input.leadTimeDemand ?? avgDaily * LEAD_TIME_DAYS,
  );
  const safetyStock = safetyStockFor(demandHistory);
  const targetStock = Math.ceil(leadTimeDemand + safetyStock);
  const available = availableStock({ currentStock, reserved, reorderPoint, safetyStock, avgDaily });
  const recommendedQty = Math.max(0, targetStock - available);
  const cover = daysOfCover({ currentStock, reserved, reorderPoint, safetyStock, avgDaily });

  const priority: ReorderPriority =
    status === "out" || status === "critical"
      ? "critical"
      : status === "low"
        ? "high"
        : trendPerDay(demandHistory) > 0.5
          ? "medium"
          : "low";

  const days = Math.round(leadTimeDemand);
  const reason =
    recommendedQty === 0
      ? `No reorder needed: ${available} sellable units cover the ${days}-unit lead-time demand plus ${safetyStock} units of safety stock.`
      : `Recommended ${recommendedQty} units because forecast demand for the next ${LEAD_TIME_DAYS} days is ${days} units, current stock is ${available} sellable units, and safety stock is ${safetyStock} units.`;

  return {
    recommendedQty,
    leadTimeDemand,
    safetyStock,
    targetStock,
    daysOfCover: cover,
    priority,
    status,
    estimatedCost: Math.round(recommendedQty * unitCost * 100) / 100,
    reason,
  };
}
