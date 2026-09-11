import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  SALES_DAYS,
  SAMPLE_PRODUCTS,
  SAMPLE_STORES,
  generateDailySales,
  generateInventory,
} from "../lib/sample-data";
import { stockStatus } from "../utils/reorder";
import { avgDailyDemand } from "../utils/forecasting";

/**
 * Loads the deterministic sample dataset (see src/lib/sample-data.ts).
 *
 * Idempotent by design: it only writes when the catalog is empty, so calling
 * it again (e.g. double-clicked in the UI) never duplicates data. Real
 * deployments replace this with proper provisioning; it exists so the demo
 * can run end-to-end without a data pipeline.
 *
 * After writing sales + inventory it also derives the initial reorder
 * recommendations and the opening activity feed, so every workflow in the
 * app has real content on first load.
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingStore = await ctx.db.query("stores").first();
    if (existingStore !== null) {
      return { seeded: false as const };
    }

    const endDate = new Date();
    const now = Date.now();

    const storeIds = new Map<string, Id<"stores">>();
    for (const store of SAMPLE_STORES) {
      const id: Id<"stores"> = await ctx.db.insert("stores", {
        code: store.code,
        name: store.name,
        city: store.city,
        status: store.status,
        createdAt: store.createdAt,
      });
      storeIds.set(store.code, id);
    }

    const productIds = new Map<
      string,
      { id: Id<"products">; unitPrice: number; unitCost: number; reorderPoint: number }
    >();
    for (const product of SAMPLE_PRODUCTS) {
      const id: Id<"products"> = await ctx.db.insert("products", {
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit,
        unitPrice: product.unitPrice,
        unitCost: product.unitCost,
        reorderPoint: product.reorderPoint,
        active: product.active,
      });
      productIds.set(product.sku, {
        id,
        unitPrice: product.unitPrice,
        unitCost: product.unitCost,
        reorderPoint: product.reorderPoint,
      });
    }

    let rows = 0;
    // units per store+product (storeCode:sku) for recommendation derivation.
    const salesHistory = new Map<string, number[]>();

    for (const store of SAMPLE_STORES) {
      const storeId = storeIds.get(store.code);
      if (storeId === undefined) continue;

      for (const product of SAMPLE_PRODUCTS) {
        const entry = productIds.get(product.sku);
        if (entry === undefined) continue;

        const position = generateInventory(
          store.code,
          product.sku,
          product.reorderPoint,
        );
        await ctx.db.insert("inventory", {
          storeId,
          productId: entry.id,
          onHand: position.onHand,
          reserved: position.reserved,
          safetyStock: position.safetyStock,
          updatedAt: position.updatedAt,
        });
        rows += 1;

        const sales = generateDailySales(
          store.code,
          product.sku,
          product.unitPrice,
          endDate,
        );
        const history: number[] = [];
        for (const row of sales) {
          await ctx.db.insert("dailySales", {
            storeId,
            productId: entry.id,
            date: row.date,
            unitsSold: row.unitsSold,
            revenue: row.revenue,
          });
          history.push(row.unitsSold);
        }
        salesHistory.set(`${store.code}:${product.sku}`, history);
        rows += sales.length;
      }
    }

    // ---- Derive reorder recommendations + activity feed -------------------
    const activities: Array<{
      kind: "stock_alert" | "reorder_recommendation" | "forecast_generated" | "inventory_update";
      message: string;
      storeCode?: string;
      createdAt: number;
    }> = [];

    let recommendations = 0;
    for (const store of SAMPLE_STORES) {
      const storeId = storeIds.get(store.code);
      if (storeId === undefined) continue;

      for (const product of SAMPLE_PRODUCTS) {
        const entry = productIds.get(product.sku);
        if (entry === undefined) continue;

        const history = salesHistory.get(`${store.code}:${product.sku}`) ?? [];
        if (history.length === 0) continue; // opening store

        // Trailing 28-day velocity decides the persisted position.
        const recent = history.slice(-28);
        const availableNow = await (async () => {
          const inv = await ctx.db
            .query("inventory")
            .withIndex("by_store_product", (q) =>
              q.eq("storeId", storeId).eq("productId", entry.id),
            )
            .first();
          return inv?.onHand ?? 0;
        })();

        const avgDaily = avgDailyDemand(history, 14);
        const status = stockStatus({
          currentStock: availableNow,
          reserved: 0,
          reorderPoint: entry.reorderPoint,
          safetyStock: 0,
          avgDaily,
        });

        if (status === "out" || status === "critical" || status === "low") {
          const leadTimeDemand = Math.round(avgDaily * 7);
          const safetyStock = Math.round(entry.reorderPoint * 0.25);
          const recommendedQty = Math.max(
            0,
            leadTimeDemand + safetyStock - availableNow,
          );
          if (recommendedQty > 0) {
            await ctx.db.insert("reorderRecommendations", {
              storeId,
              productId: entry.id,
              status: "suggested",
              recommendedQty,
              leadTimeDemand,
              safetyStock,
              priority: status === "out" || status === "critical" ? "critical" : "high",
              reason: `Recommended ${recommendedQty} units because forecast demand for the next 7 days is ${leadTimeDemand} units, current stock is ${availableNow} sellable units, and safety stock is ${safetyStock} units.`,
              estimatedCost: Math.round(recommendedQty * entry.unitCost * 100) / 100,
              createdAt: now,
              updatedAt: now,
            });
            recommendations += 1;
            activities.push({
              kind: "reorder_recommendation",
              message: `${recommendedQty} units of ${product.name} recommended for ${store.code}`,
              storeCode: store.code,
              createdAt: now - recommendations * 3_600_000,
            });
          }
        }

        if (status === "out") {
          activities.push({
            kind: "stock_alert",
            message: `${product.name} is out of stock at ${store.code}`,
            storeCode: store.code,
            createdAt: now - (recommendations + 0.5) * 3_600_000,
          });
        }
      }

      activities.push({
        kind: "forecast_generated",
        message: `Nightly demand forecast generated for ${store.code}`,
        storeCode: store.code,
        createdAt: now - (recommendations + 1) * 3_600_000,
      });
    }

    for (const activity of activities) {
      const storeId = activity.storeCode
        ? storeIds.get(activity.storeCode)
        : undefined;
      await ctx.db.insert("activityLog", {
        kind: activity.kind,
        message: activity.message,
        storeId,
        createdAt: activity.createdAt,
      });
    }

    return {
      seeded: true as const,
      stores: SAMPLE_STORES.length,
      products: SAMPLE_PRODUCTS.length,
      rows,
      salesDays: SALES_DAYS,
      recommendations,
      activities: activities.length,
    };
  },
});
