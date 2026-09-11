import { query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import { stockStatus } from "../utils/reorder";
import { avgDailyDemand } from "../utils/forecasting";

/**
 * Operations module: cross-cutting reads that don't belong to a single
 * domain — the activity feed, per-store detail pages and admin user data.
 */

/** Latest operational events, newest first. */
export const getActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 12, 1), 50);
    const rows = await ctx.db
      .query("activityLog")
      .withIndex("by_created")
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      kind: row.kind,
      message: row.message,
      createdAt: row.createdAt,
    }));
  },
});

/**
 * Store detail payload: profile, position summary, revenue/units for the
 * trailing 30 days, per-product positions with health status, and the
 * store's active recommendations.
 */
export const getStoreDetail = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (store === null) return null;

    const products = keyById(await ctx.db.query("products").collect());
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const fromDate = isoDaysBefore(new Date(), 29);
    const today = toISODate(new Date());
    const sales = await ctx.db
      .query("dailySales")
      .withIndex("by_store_date", (q) => q.eq("storeId", args.storeId))
      .collect();

    let revenue30 = 0;
    let units30 = 0;
    const historyByProduct = new Map<string, number[]>();
    for (const row of sales) {
      if (row.date >= fromDate && row.date <= today) {
        revenue30 += row.revenue;
        units30 += row.unitsSold;
      }
      const list = historyByProduct.get(row.productId) ?? [];
      list.push(row.unitsSold);
      historyByProduct.set(row.productId, list);
    }

    const positions = inventory
      .map((row) => {
        const product = products.get(row.productId);
        if (product === undefined) return null;
        const history = historyByProduct.get(row.productId) ?? [];
        const avgDaily = avgDailyDemand(history, 14);
        const status = stockStatus({
          currentStock: row.onHand,
          reserved: row.reserved,
          reorderPoint: product.reorderPoint,
          safetyStock: row.safetyStock ?? 0,
          avgDaily,
        });
        return {
          productId: row.productId,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unitPrice: product.unitPrice,
          onHand: row.onHand,
          reserved: row.reserved,
          reorderPoint: product.reorderPoint,
          avgDailyUnits: avgDaily,
          status,
        };
      })
      .filter(
        (
          row,
        ): row is NonNullable<typeof row> => row !== null,
      )
      .sort((a, b) => b.onHand - a.onHand);

    const counts = { healthy: 0, low: 0, critical: 0, out: 0, overstocked: 0 };
    for (const position of positions) {
      counts[position.status] += 1;
    }

    const recommendations = await ctx.db
      .query("reorderRecommendations")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();
    const activeRecommendations = recommendations.filter(
      (r) => r.status !== "completed",
    );

    return {
      store: {
        id: store._id,
        code: store.code,
        name: store.name,
        city: store.city ?? "",
        status: store.status ?? "active",
        createdAt: store.createdAt ?? "",
      },
      revenue30: Math.round(revenue30 * 100) / 100,
      units30,
      counts,
      positions,
      activeRecommendations: activeRecommendations.length,
      generatedAt: today,
    };
  },
});

/** Users with roles for the Admin area (demo: current sign-up pool). */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? "viewer",
      isAnonymous: user.isAnonymous ?? false,
      createdAt: user._creationTime,
    }));
  },
});
