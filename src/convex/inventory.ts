import { query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import { avgDailyDemand, trendPerDay } from "../utils/forecasting";
import {
  availableStock,
  daysOfCover,
  shortfallUnits,
  stockStatus,
  stockStatusRank,
  type StockStatus,
} from "../utils/reorder";

export const RANGES = [7, 14, 30] as const;
export type RangeDays = (typeof RANGES)[number];

function normalizeRange(days: number | undefined): RangeDays {
  return RANGES.includes(days as RangeDays) ? (days as RangeDays) : 30;
}

// -- Local view contracts (mirror src/types/views.ts, kept dependency-free) --

interface ProductView {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  reorderPoint: number;
}

interface InventoryItemSummaryView {
  product: ProductView;
  storeCode: string;
  onHand: number;
  reserved: number;
  available: number;
  avgDailyUnits: number;
  daysOfCover: number;
  status: StockStatus;
  shortfallUnits: number;
}

interface HealthCounts {
  healthy: number;
  low: number;
  critical: number;
  out: number;
  overstocked: number;
}

interface DashboardPayload {
  health: {
    totals: {
      skuCount: number;
      storeCount: number;
      unitsOnHand: number;
      stockValue: number;
    };
    counts: HealthCounts;
  };
  lowStock: InventoryItemSummaryView[];
  salesTrend: Array<{ date: string; unitsSold: number; revenue: number }>;
  rangeDays: number;
  revenue: number;
  unitsSold: number;
  previousRevenue: number;
  previousUnitsSold: number;
  pendingRecommendations: number;
  generatedAt: string;
}

interface StorePayload {
  id: string;
  code: string;
  name: string;
  city: string;
  status: "active" | "opening" | "closed";
}

function emptyCounts(): HealthCounts {
  return { healthy: 0, low: 0, critical: 0, out: 0, overstocked: 0 };
}

function emptyDashboard(rangeDays: RangeDays): DashboardPayload {
  return {
    health: {
      totals: { skuCount: 0, storeCount: 0, unitsOnHand: 0, stockValue: 0 },
      counts: emptyCounts(),
    },
    lowStock: [],
    salesTrend: [],
    rangeDays,
    revenue: 0,
    unitsSold: 0,
    previousRevenue: 0,
    previousUnitsSold: 0,
    pendingRecommendations: 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Full dashboard payload: inventory health, low-stock queue, sales trend and
 * period comparisons. Single reactive query so every connected client sees
 * one consistent snapshot.
 */
export const getDashboardSummary = query({
  args: {
    storeId: v.optional(v.id("stores")),
    rangeDays: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DashboardPayload> => {
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
    const storeById = keyById(stores);
    const today = toISODate(new Date());
    const fromDate = isoDaysBefore(new Date(), rangeDays - 1);
    const prevFromDate = isoDaysBefore(new Date(), rangeDays * 2 - 1);
    const prevToDate = isoDaysBefore(new Date(), rangeDays);

    const scopedInventory = storeFilter
      ? inventory.filter((row) => row.storeId === storeFilter)
      : inventory;

    // Daily sales for the scope, accumulated per store+product so trailing
    // window statistics operate on correct per-position time series.
    const salesRows = storeFilter
      ? await ctx.db
          .query("dailySales")
          .withIndex("by_store_date", (q) => q.eq("storeId", storeFilter))
          .collect()
      : await ctx.db.query("dailySales").collect();

    interface Velocity {
      units: number;
      days: number;
      /** Full history for this store+product, oldest first. */
      history: number[];
    }
    const velocity = new Map<string, Velocity>();
    let currentRevenue = 0;
    let currentUnits = 0;
    let previousRevenue = 0;
    let previousUnits = 0;
    const trendTotals = new Map<string, { unitsSold: number; revenue: number }>();

    for (const row of salesRows) {
      const product = productById.get(row.productId);
      if (product === undefined) continue;

      const key = storeFilter
        ? row.productId
        : `${row.storeId}:${row.productId}`;
      const entry = velocity.get(key) ?? { units: 0, days: 0, history: [] };
      entry.units += row.unitsSold;
      entry.days += 1;
      entry.history.push(row.unitsSold);
      velocity.set(key, entry);

      const inCurrent = row.date >= fromDate && row.date <= today;
      const inPrevious = row.date >= prevFromDate && row.date <= prevToDate;
      if (inCurrent) {
        currentRevenue += row.revenue;
        currentUnits += row.unitsSold;
        const totals = trendTotals.get(row.date) ?? { unitsSold: 0, revenue: 0 };
        totals.unitsSold += row.unitsSold;
        totals.revenue += row.revenue;
        trendTotals.set(row.date, totals);
      }
      if (inPrevious) {
        previousRevenue += row.revenue;
        previousUnits += row.unitsSold;
      }
    }

    // ---- Inventory health -------------------------------------------------
    let unitsOnHand = 0;
    let stockValue = 0;
    const counts = emptyCounts();
    const lowStock: InventoryItemSummaryView[] = [];

    for (const row of scopedInventory) {
      const product = productById.get(row.productId);
      if (product === undefined) continue;

      const velocityKey = storeFilter
        ? row.productId
        : `${row.storeId}:${row.productId}`;
      const history = velocity.get(velocityKey)?.history ?? [];
      const avgDaily = avgDailyDemand(history, 14);

      const context = {
        currentStock: row.onHand,
        reserved: row.reserved,
        reorderPoint: product.reorderPoint,
        safetyStock: row.safetyStock ?? 0,
        avgDaily,
      };
      const status = stockStatus(context);
      counts[status] += 1;
      unitsOnHand += row.onHand;
      stockValue += row.onHand * (product.unitCost ?? product.unitPrice * 0.55);

      if (status === "out" || status === "critical" || status === "low") {
        const store = storeById.get(row.storeId);
        if (store === undefined) continue;
        lowStock.push({
          storeCode: store.code,
          product: {
            id: product._id,
            sku: product.sku,
            name: product.name,
            category: product.category,
            unitPrice: product.unitPrice,
            reorderPoint: product.reorderPoint,
          },
          onHand: row.onHand,
          reserved: row.reserved,
          available: availableStock(context),
          avgDailyUnits: avgDaily,
          daysOfCover: daysOfCover(context),
          status,
          shortfallUnits: shortfallUnits(context),
        });
      }
    }

    lowStock.sort((a, b) => {
      const byStatus = stockStatusRank(a.status) - stockStatusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return b.shortfallUnits - a.shortfallUnits;
    });

    const health = {
      totals: {
        skuCount: products.filter((p) => p.active !== false).length,
        storeCount: storeFilter
          ? 1
          : stores.filter((s) => s.status !== "closed").length,
        unitsOnHand,
        stockValue: Math.round(stockValue * 100) / 100,
      },
      counts,
    };

    const salesTrend: Array<{ date: string; unitsSold: number; revenue: number }> = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      const totals = trendTotals.get(date) ?? { unitsSold: 0, revenue: 0 };
      salesTrend.push({ date, ...totals });
    }

    const pending = await ctx.db
      .query("reorderRecommendations")
      .withIndex("by_status", (q) => q.eq("status", "suggested"))
      .collect();

    return {
      health,
      lowStock: lowStock.slice(0, 8),
      salesTrend,
      rangeDays,
      revenue: Math.round(currentRevenue * 100) / 100,
      unitsSold: currentUnits,
      previousRevenue: Math.round(previousRevenue * 100) / 100,
      previousUnitsSold: previousUnits,
      pendingRecommendations: pending
        .filter((r) => !storeFilter || r.storeId === storeFilter)
        .length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/** Stores for the scope filter, sorted by code. */
export const listStores = query({
  args: {},
  handler: async (ctx): Promise<StorePayload[]> => {
    const stores = await ctx.db.query("stores").collect();
    return stores
      .map(
        (store): StorePayload => ({
          id: store._id,
          code: store.code,
          name: store.name,
          city: store.city ?? "",
          status: store.status ?? "active",
        }),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  },
});

/** Per-store performance for the selected window (dashboard + analytics). */
export const getStorePerformance = query({
  args: {
    rangeDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rangeDays = normalizeRange(args.rangeDays);
    const stores = await ctx.db.query("stores").collect();
    const fromDate = isoDaysBefore(new Date(), rangeDays - 1);
    const today = toISODate(new Date());
    const prevFromDate = isoDaysBefore(new Date(), rangeDays * 2 - 1);
    const prevToDate = isoDaysBefore(new Date(), rangeDays);

    const perf = new Map<
      string,
      {
        storeId: string;
        code: string;
        name: string;
        city: string;
        status: string;
        revenue: number;
        units: number;
        prevRevenue: number;
      }
    >();
    for (const store of stores) {
      perf.set(store._id, {
        storeId: store._id,
        code: store.code,
        name: store.name,
        city: store.city ?? "",
        status: store.status ?? "active",
        revenue: 0,
        units: 0,
        prevRevenue: 0,
      });
    }

    const sales = await ctx.db.query("dailySales").collect();
    for (const row of sales) {
      const entry = perf.get(row.storeId);
      if (entry === undefined) continue;
      if (row.date >= fromDate && row.date <= today) {
        entry.revenue += row.revenue;
        entry.units += row.unitsSold;
      } else if (row.date >= prevFromDate && row.date <= prevToDate) {
        entry.prevRevenue += row.revenue;
      }
    }

    // Inventory health per store (attention share drives stockout risk).
    const products = await ctx.db.query("products").collect();
    const productById = keyById(products);
    const inventory = await ctx.db.query("inventory").collect();
    const healthCounts = new Map<string, HealthCounts>();
    for (const row of inventory) {
      const product = productById.get(row.productId);
      if (product === undefined) continue;
      const counts = healthCounts.get(row.storeId) ?? emptyCounts();
      const status = stockStatus({
        currentStock: row.onHand,
        reserved: row.reserved,
        reorderPoint: product.reorderPoint,
        safetyStock: row.safetyStock ?? 0,
        avgDaily: 0,
      });
      counts[status] += 1;
      healthCounts.set(row.storeId, counts);
    }

    return Array.from(perf.values())
      .map((entry) => {
        const counts = healthCounts.get(entry.storeId) ?? emptyCounts();
        const total = counts.healthy + counts.low + counts.critical + counts.out;
        const attention = counts.low + counts.critical + counts.out;
        return {
          ...entry,
          revenue: Math.round(entry.revenue * 100) / 100,
          prevRevenue: Math.round(entry.prevRevenue * 100) / 100,
          lowStockCount: attention,
          healthRate: total > 0 ? Math.round((counts.healthy / total) * 100) : 0,
          stockoutRisk: total > 0 ? Math.round((attention / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },
});

/**
 * Flat position list with product/store joins and per-position health —
 * powers the Inventory page's search/filter/sort/pagination client-side.
 */
export const listPositions = query({
  args: {
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const stores = await ctx.db.query("stores").collect();
    const storeById = keyById(stores);
    const products = await ctx.db.query("products").collect();
    const productById = keyById(products);
    const inventory = args.storeId
      ? await ctx.db
          .query("inventory")
          .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
          .collect()
      : await ctx.db.query("inventory").collect();

    const sales = await ctx.db.query("dailySales").collect();
    const historyByPosition = new Map<string, number[]>();
    for (const row of sales) {
      const key = `${row.storeId}:${row.productId}`;
      const list = historyByPosition.get(key) ?? [];
      list.push(row.unitsSold);
      historyByPosition.set(key, list);
    }

    const positions = [];
    for (const row of inventory) {
      const product = productById.get(row.productId);
      const store = storeById.get(row.storeId);
      if (product === undefined || store === undefined) continue;

      const history = historyByPosition.get(`${row.storeId}:${row.productId}`) ?? [];
      const avgDaily = avgDailyDemand(history, 14);
      const context = {
        currentStock: row.onHand,
        reserved: row.reserved,
        reorderPoint: product.reorderPoint,
        safetyStock: row.safetyStock ?? 0,
        avgDaily,
      };
      const status = stockStatus(context);
      const unitCost = product.unitCost ?? product.unitPrice * 0.55;
      positions.push({
        key: `${row.storeId}:${row.productId}`,
        storeId: row.storeId,
        storeCode: store.code,
        storeName: store.name,
        productId: row.productId,
        sku: product.sku,
        name: product.name,
        category: product.category,
        unitPrice: product.unitPrice,
        unitCost: Math.round(unitCost * 100) / 100,
        reorderPoint: product.reorderPoint,
        onHand: row.onHand,
        reserved: row.reserved,
        available: availableStock(context),
        avgDailyUnits: avgDaily,
        daysOfCover: daysOfCover(context),
        status,
        stockValue: Math.round(row.onHand * unitCost * 100) / 100,
        updatedAt: row.updatedAt ?? 0,
      });
    }
    return positions;
  },
});

/** Demand drift per product — feeds "rising/declining demand" narratives. */
export const getDemandSignals = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const sales = await ctx.db.query("dailySales").collect();

    // Chain-wide history per product (trend narrative is catalog-level).
    const historyByProduct = new Map<string, number[]>();
    for (const row of sales) {
      const list = historyByProduct.get(row.productId) ?? [];
      list.push(row.unitsSold);
      historyByProduct.set(row.productId, list);
    }

    const signals: Array<{
      productId: string;
      sku: string;
      name: string;
      category: string;
      trendPerDay: number;
      avgDaily: number;
    }> = [];
    for (const product of products) {
      const history = historyByProduct.get(product._id) ?? [];
      if (history.length === 0) continue;
      signals.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        trendPerDay: trendPerDay(history, 28),
        avgDaily: avgDailyDemand(history, 14),
      });
    }
    return signals;
  },
});
