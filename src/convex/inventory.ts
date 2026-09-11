import { query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import {
  daysOfCover,
  shortfallUnits,
  stockStatus,
  stockStatusRank,
} from "../utils/inventory";
import type {
  DashboardView,
  InventoryHealthView,
  InventoryItemView,
  ProductView,
  SalesTrendPoint,
  StoreView,
} from "../types/views";

export const RANGES = [7, 14, 30] as const;
export type RangeDays = (typeof RANGES)[number];

function normalizeRange(days: number | undefined): RangeDays {
  return RANGES.includes(days as RangeDays) ? (days as RangeDays) : 30;
}

function emptyDashboard(rangeDays: RangeDays): DashboardView {
  const health: InventoryHealthView = {
    totals: { skuCount: 0, storeCount: 0, unitsOnHand: 0, stockValue: 0 },
    counts: { healthy: 0, low: 0, out: 0 },
  };
  return {
    health,
    lowStock: [],
    salesTrend: [],
    rangeDays,
    generatedAt: new Date().toISOString(),
  };
}

interface VelocityEntry {
  units: number;
  days: number;
}

/**
 * Aggregated dashboard payload for version 1: inventory health, low-stock
 * items and the sales trend for the requested window.
 *
 * Runs as a single reactive query so every connected client sees the same
 * consistent snapshot. With an optional storeId it scopes to one location.
 */
export const getDashboardSummary = query({
  args: {
    storeId: v.optional(v.id("stores")),
    rangeDays: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DashboardView> => {
    const rangeDays = normalizeRange(args.rangeDays);
    const storeFilter = args.storeId;

    const [stores, products, inventory] = await Promise.all([
      ctx.db.query("stores").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("inventory").collect(),
    ]);

    if (stores.length === 0 || products.length === 0) {
      return emptyDashboard(rangeDays);
    }

    const productById = keyById(products);
    const today = toISODate(new Date());
    const fromDate = isoDaysBefore(new Date(), rangeDays - 1);

    const scopedInventory = storeFilter
      ? inventory.filter((row) => row.storeId === storeFilter)
      : inventory;

    // Sales history for the scope. Only the last `rangeDays` days feed the
    // trend chart; the full window feeds average daily velocity.
    const salesRows = storeFilter
      ? await ctx.db
          .query("dailySales")
          .withIndex("by_store_date", (q) => q.eq("storeId", storeFilter))
          .collect()
      : await ctx.db.query("dailySales").collect();

    const velocity = new Map<string, VelocityEntry>();
    for (const row of salesRows) {
      const key = `${row.storeId}:${row.productId}`;
      const entry = velocity.get(key) ?? { units: 0, days: 0 };
      entry.units += row.unitsSold;
      entry.days += 1;
      velocity.set(key, entry);
    }

    // ---- Inventory health -------------------------------------------------
    let unitsOnHand = 0;
    let stockValue = 0;
    const counts = { healthy: 0, low: 0, out: 0 };
    const lowStock: InventoryItemView[] = [];

    for (const row of scopedInventory) {
      const product = productById.get(row.productId);
      if (product === undefined) continue;

      const available = Math.max(0, row.onHand - row.reserved);
      const status = stockStatus(row.onHand, row.reserved, product.reorderPoint);
      counts[status] += 1;
      unitsOnHand += row.onHand;
      stockValue += row.onHand * product.unitPrice;

      if (status !== "healthy") {
        const velocityKey = `${row.storeId}:${row.productId}`;
        const stats = velocity.get(velocityKey);
        const avgDailyUnits = stats && stats.days > 0 ? stats.units / stats.days : 0;
        lowStock.push({
          product: {
            id: product._id,
            sku: product.sku,
            name: product.name,
            category: product.category,
            unitPrice: product.unitPrice,
            reorderPoint: product.reorderPoint,
          } satisfies ProductView,
          onHand: row.onHand,
          reserved: row.reserved,
          available,
          avgDailyUnits,
          daysOfCover: daysOfCover(row.onHand, row.reserved, avgDailyUnits),
          status,
          shortfallUnits: shortfallUnits(
            row.onHand,
            row.reserved,
            product.reorderPoint,
          ),
        });
      }
    }

    lowStock.sort((a, b) => {
      const byStatus =
        stockStatusRank(a.status) - stockStatusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return b.shortfallUnits - a.shortfallUnits;
    });

    const health: InventoryHealthView = {
      totals: {
        skuCount: products.length,
        storeCount: storeFilter ? 1 : stores.length,
        unitsOnHand,
        stockValue: Math.round(stockValue * 100) / 100,
      },
      counts,
    };

    // ---- Sales trend ------------------------------------------------------
    const trendTotals = new Map<string, { unitsSold: number; revenue: number }>();
    for (const row of salesRows) {
      if (row.date < fromDate || row.date > today) continue;
      const totals = trendTotals.get(row.date) ?? { unitsSold: 0, revenue: 0 };
      totals.unitsSold += row.unitsSold;
      totals.revenue += row.revenue;
      trendTotals.set(row.date, totals);
    }

    const salesTrend: SalesTrendPoint[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      const totals = trendTotals.get(date) ?? { unitsSold: 0, revenue: 0 };
      salesTrend.push({ date, ...totals });
    }

    return {
      health,
      lowStock: lowStock.slice(0, 8),
      salesTrend,
      rangeDays,
      generatedAt: new Date().toISOString(),
    };
  },
});

/** Stores for the dashboard scope filter, sorted by code. */
export const listStores = query({
  args: {},
  handler: async (ctx): Promise<StoreView[]> => {
    const stores = await ctx.db.query("stores").collect();
    return stores
      .map(
        (store): StoreView => ({
          id: store._id,
          code: store.code,
          name: store.name,
          city: store.city ?? "",
        }),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  },
});
