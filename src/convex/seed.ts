import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  SALES_DAYS,
  SAMPLE_PRODUCTS,
  SAMPLE_STORES,
  generateDailySales,
  generateInventory,
} from "../lib/sample-data";
/**
 * Loads the deterministic sample dataset (see src/lib/sample-data.ts).
 *
 * Idempotent by design: it only writes when the catalog is empty, so calling
 * it again (e.g. double-clicked in the UI) never duplicates data. Real
 * deployments replace this with proper provisioning; it exists so version 1
 * can demo end-to-end without a data pipeline.
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingStore = await ctx.db.query("stores").first();
    if (existingStore !== null) {
      return { seeded: false as const };
    }

    const endDate = new Date();

    const storeIds = new Map<string, Id<"stores">>();
    for (const store of SAMPLE_STORES) {
      const id: Id<"stores"> = await ctx.db.insert("stores", {
        code: store.code,
        name: store.name,
        city: store.city,
      });
      storeIds.set(store.code, id);
    }

    const productIds = new Map<
      string,
      { id: Id<"products">; unitPrice: number; reorderPoint: number }
    >();
    for (const product of SAMPLE_PRODUCTS) {
      const id: Id<"products"> = await ctx.db.insert("products", {
        sku: product.sku,
        name: product.name,
        category: product.category,
        unitPrice: product.unitPrice,
        reorderPoint: product.reorderPoint,
      });
      productIds.set(product.sku, {
        id,
        unitPrice: product.unitPrice,
        reorderPoint: product.reorderPoint,
      });
    }

    let rows = 0;
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
        });
        rows += 1;

        const sales = generateDailySales(
          store.code,
          product.sku,
          product.unitPrice,
          endDate,
        );
        for (const row of sales) {
          await ctx.db.insert("dailySales", {
            storeId,
            productId: entry.id,
            date: row.date,
            unitsSold: row.unitsSold,
            revenue: row.revenue,
          });
        }
        rows += sales.length;
      }
    }

    return {
      seeded: true as const,
      stores: SAMPLE_STORES.length,
      products: SAMPLE_PRODUCTS.length,
      rows,
      salesDays: SALES_DAYS,
    };
  },
});
