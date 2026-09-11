/**
 * Pure inventory-domain calculations.
 *
 * These functions are free of I/O and framework code so they can be unit
 * tested independently and reused by Convex queries, backend services, and
 * the UI without duplication.
 */

/** Days of average daily demand currently coverable by sellable stock. */
export function daysOfCover(onHand: number, reserved: number, avgDailyUnits: number): number {
  const available = Math.max(0, onHand - reserved);
  if (avgDailyUnits <= 0) {
    return available > 0 ? Infinity : 0;
  }
  return available / avgDailyUnits;
}

export type StockStatus = "out" | "low" | "healthy";

/** Compare a stock position against its reorder point. */
export function stockStatus(
  onHand: number,
  reserved: number,
  reorderPoint: number,
): StockStatus {
  const available = Math.max(0, onHand - reserved);
  if (available <= 0) return "out";
  if (available <= reorderPoint) return "low";
  return "healthy";
}

export type StockStatusRank = 0 | 1 | 2;

/** Sort priority: out-of-stock first, then low, then healthy. */
export function stockStatusRank(status: StockStatus): StockStatusRank {
  switch (status) {
    case "out":
      return 0;
    case "low":
      return 1;
    case "healthy":
      return 2;
  }
}

/** How far the stock position is below its reorder point (0 when healthy). */
export function shortfallUnits(
  onHand: number,
  reserved: number,
  reorderPoint: number,
): number {
  const available = Math.max(0, onHand - reserved);
  return Math.max(0, reorderPoint - available);
}

/** Suggested reorder quantity, rounded up to a whole pack size when given. */
export function reorderQuantity(
  onHand: number,
  reserved: number,
  reorderPoint: number,
  targetUnits: number,
  packSize = 1,
): number {
  const gap = Math.max(0, targetUnits - Math.max(0, onHand - reserved));
  return Math.ceil(gap / packSize) * packSize;
}

/** Sum units/revenue over an already-filtered list of daily aggregates. */
export function sumDaily(
  rows: ReadonlyArray<{ unitsSold: number; revenue: number }>,
): { unitsSold: number; revenue: number } {
  return rows.reduce(
    (acc, row) => ({
      unitsSold: acc.unitsSold + row.unitsSold,
      revenue: acc.revenue + row.revenue,
    }),
    { unitsSold: 0, revenue: 0 },
  );
}

/** Percentage change between two non-negative totals. */
export function percentChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}
