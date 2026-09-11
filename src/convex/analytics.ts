import { query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import { stockStatus } from "../utils/reorder";
import type { HealthCounts } from "../types/views";

/**
 * Analytics service — aggregate slices for the Analytics page:
 * sales analytics (by time/store/category/product) and inventory analytics
 * (value, turnover, low-stock and overstock rates).
 */

/** Revenue + units per day for the last `days` days, chain-wide or per store. */
export const getRevenueSeries = query({
  args: {
    days: v.optional(v.number()),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const days = Math.min(Math.max(args.days ?? 90, 7), 180);
    const fromDate = isoDaysBefore(new Date(), days - 1);
    const today = toISODate(new Date());

    const rows = args.storeId
      ? await ctx.db
          .query("dailySales")
          .withIndex("by_store_date", (q) => q.eq("storeId", args.storeId!))
          .collect()
      : await ctx.db.query("dailySales").collect();

    const totals = new Map<string, { revenue: number; units: number }>();
    for (const row of rows) {
      if (row.date < fromDate || row.date > today) continue;
      const entry = totals.get(row.date) ?? { revenue: 0, units: 0 };
      entry.revenue += row.revenue;
      entry.units += row.unitsSold;
      totals.set(row.date, entry);
    }

    const series: Array<{ date: string; revenue: number; units: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      const entry = totals.get(date) ?? { revenue: 0, units: 0 };
      series.push({
        date,
        revenue: Math.round(entry.revenue * 100) / 100,
        units: entry.units,
      });
    }
    return series;
  },
});

/** Revenue by category for the selected window. */
export const getCategoryPerformance = query({
  args: { rangeDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rangeDays = Math.min(Math.max(args.rangeDays ?? 30, 7), 120);
    const fromDate = isoDaysBefore(new Date(), rangeDays - 1);

    const products = keyById(await ctx.db.query("products").collect());
    const rows = await ctx.db.query("dailySales").collect();

    const byCategory = new Map<string, { revenue: number; units: number }>();
    for (const row of rows) {
      if (row.date < fromDate) continue;
      const product = products.get(row.productId);
      if (product === undefined) continue;
      const entry = byCategory.get(product.category) ?? { revenue: 0, units: 0 };
      entry.revenue += row.revenue;
      entry.units += row.unitsSold;
      byCategory.set(product.category, entry);
    }

    return Array.from(byCategory.entries())
      .map(([category, totals]) => ({
        category,
        revenue: Math.round(totals.revenue * 100) / 100,
        units: totals.units,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  },
});

/** Top products by revenue for the selected window. */
export const getTopProducts = query({
  args: {
    rangeDays: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rangeDays = Math.min(Math.max(args.rangeDays ?? 30, 7), 120);
    const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);
    const fromDate = isoDaysBefore(new Date(), rangeDays - 1);

    const products = keyById(await ctx.db.query("products").collect());
    const rows = await ctx.db.query("dailySales").collect();

    const byProduct = new Map<string, { revenue: number; units: number }>();
    for (const row of rows) {
      if (row.date < fromDate) continue;
      const entry = byProduct.get(row.productId) ?? { revenue: 0, units: 0 };
      entry.revenue += row.revenue;
      entry.units += row.unitsSold;
      byProduct.set(row.productId, entry);
    }

    return Array.from(byProduct.entries())
      .map(([productId, totals]) => {
        const product = products.get(productId);
        return {
          productId,
          sku: product?.sku ?? "—",
          name: product?.name ?? "—",
          category: product?.category ?? "—",
          revenue: Math.round(totals.revenue * 100) / 100,
          units: totals.units,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },
});

/**
 * Inventory analytics: capital by category, turnover over the trailing 30
 * days (units sold / average units on hand), low-stock and overstock rates.
 */
export const getInventoryAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const products = keyById(await ctx.db.query("products").collect());
    const inventory = await ctx.db.query("inventory").collect();
    const fromDate = isoDaysBefore(new Date(), 29);
    const sales = await ctx.db.query("dailySales").collect();

    const unitsSold30 = new Map<string, number>();
    for (const row of sales) {
      if (row.date < fromDate) continue;
      unitsSold30.set(
        row.productId,
        (unitsSold30.get(row.productId) ?? 0) + row.unitsSold,
      );
    }

    const counts: HealthCounts = {
      healthy: 0,
      low: 0,
      critical: 0,
      out: 0,
      overstocked: 0,
    };
    let stockValue = 0;
    let unitsOnHand = 0;
    const byCategory = new Map<string, { value: number; units: number }>();

    for (const row of inventory) {
      const product = products.get(row.productId);
      if (product === undefined) continue;
      const unitCost = product.unitCost ?? product.unitPrice * 0.55;

      counts[
        stockStatus({
          currentStock: row.onHand,
          reserved: row.reserved,
          reorderPoint: product.reorderPoint,
          safetyStock: row.safetyStock ?? 0,
          avgDaily: 0,
        })
      ] += 1;

      stockValue += row.onHand * unitCost;
      unitsOnHand += row.onHand;
      const entry = byCategory.get(product.category) ?? { value: 0, units: 0 };
      entry.value += row.onHand * unitCost;
      entry.units += row.onHand;
      byCategory.set(product.category, entry);
    }

    const positions = counts.healthy + counts.low + counts.critical + counts.out;
    const totalUnitsSold30 = Array.from(unitsSold30.values()).reduce(
      (sum, v) => sum + v,
      0,
    );

    return {
      stockValue: Math.round(stockValue * 100) / 100,
      unitsOnHand,
      /** Inventory turns over the trailing 30 days (COGS proxy basis). */
      turnover30d:
        unitsOnHand > 0
          ? Math.round((totalUnitsSold30 / unitsOnHand) * 100) / 100
          : 0,
      lowStockRate: positions > 0 ? Math.round(((counts.low + counts.critical) / positions) * 100) : 0,
      stockoutRate: positions > 0 ? Math.round((counts.out / positions) * 100) : 0,
      overstockRate: positions > 0 ? Math.round((counts.overstocked / positions) * 100) : 0,
      counts,
      valueByCategory: Array.from(byCategory.entries())
        .map(([category, totals]) => ({
          category,
          value: Math.round(totals.value * 100) / 100,
          units: totals.units,
        }))
        .sort((a, b) => b.value - a.value),
    };
  },
});
