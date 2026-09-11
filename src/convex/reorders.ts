import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import { MODELS, type ModelId } from "../utils/forecasting";
import {
  LEAD_TIME_DAYS,
  recommendReorder,
  type ReorderRecommendation as EngineResult,
} from "../utils/reorder";

/**
 * Reorder recommendation service.
 *
 * The engine (src/utils/reorder.ts) computes the numbers; this module stores
 * and advances the workflow. Recommendations are regenerated on demand from
 * live positions + demand history and are upserted into the workflow table —
 * a position that already has an active (suggested/approved/ordered)
 * recommendation is updated in place instead of duplicated.
 */

const ACTIVE_STATUSES = ["suggested", "approved", "ordered"] as const;

function isModelId(value: string): value is ModelId {
  return value in MODELS;
}

interface EngineInput {
  currentStock: number;
  reserved: number;
  reorderPoint: number;
  safetyStock: number;
  demandHistory: number[];
  unitCost: number;
}

function workflowPriority(status: string): "critical" | "high" | "medium" | "low" {
  if (status === "out" || status === "critical") return "critical";
  if (status === "low") return "high";
  return "medium";
}

/**
 * Recompute recommendations for every position and upsert them into the
 * workflow table. Returns the fresh full list for the requested scope.
 */
export const refreshRecommendations = mutation({
  args: {
    storeId: v.optional(v.id("stores")),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const modelId =
      args.modelId !== undefined && isModelId(args.modelId)
        ? args.modelId
        : "moving-average-7" as ModelId;
    const model = MODELS[modelId];

    const stores = await ctx.db.query("stores").collect();
    const products = await ctx.db.query("products").collect();
    const productById = keyById(products);
    const storeById = keyById(stores);
    const inventory = await ctx.db.query("inventory").collect();
    const sales = await ctx.db.query("dailySales").collect();

    // Demand history per store+product (chain-wide when unscoped).
    const historyByPosition = new Map<string, number[]>();
    for (const row of sales) {
      const key = args.storeId
        ? row.productId
        : `${row.storeId}:${row.productId}`;
      const list = historyByPosition.get(key) ?? [];
      list.push(row.unitsSold);
      historyByPosition.set(key, list);
    }

    const now = Date.now();
    let upserted = 0;

    for (const row of inventory) {
      if (args.storeId !== undefined && row.storeId !== args.storeId) continue;
      const product = productById.get(row.productId);
      if (product === undefined) continue;

      const key = args.storeId
        ? row.productId
        : `${row.storeId}:${row.productId}`;
      const demandHistory = historyByPosition.get(key) ?? [];
      if (demandHistory.length < 7) continue; // opening stores, no signal

      const engine: EngineResult = recommendReorder({
        currentStock: row.onHand,
        reserved: row.reserved,
        reorderPoint: product.reorderPoint,
        safetyStock: row.safetyStock ?? 0,
        avgDaily: 0,
        demandHistory,
        unitCost: product.unitCost ?? product.unitPrice * 0.55,
      });
      // Forecast-based lead-time demand from the shared model code.
      const modelDemand = model.forecast(demandHistory, LEAD_TIME_DAYS);
      const leadTimeDemand = Math.round(
        modelDemand.reduce((sum, v) => sum + v, 0),
      );

      if (engine.recommendedQty <= 0) {
        // Position is fine — retire any stale active suggestion.
        const existing = await ctx.db
          .query("reorderRecommendations")
          .withIndex("by_store_product", (q) =>
            q.eq("storeId", row.storeId).eq("productId", row.productId),
          )
          .collect();
        for (const rec of existing) {
          if ((ACTIVE_STATUSES as readonly string[]).includes(rec.status)) {
            await ctx.db.patch(rec._id, {
              status: "completed",
              updatedAt: now,
            });
          }
        }
        continue;
      }

      const existing = await ctx.db
        .query("reorderRecommendations")
        .withIndex("by_store_product", (q) =>
          q.eq("storeId", row.storeId).eq("productId", row.productId),
        )
        .collect();
      const active = existing.find((rec) =>
        (ACTIVE_STATUSES as readonly string[]).includes(rec.status),
      );

      const reason = `Recommended ${engine.recommendedQty} units because forecast demand for the next ${LEAD_TIME_DAYS} days is ${leadTimeDemand} units, current stock is ${row.onHand - row.reserved} sellable units, and safety stock is ${engine.safetyStock} units.`;

      if (active !== undefined && active.status === "suggested") {
        await ctx.db.patch(active._id, {
          recommendedQty: engine.recommendedQty,
          leadTimeDemand,
          safetyStock: engine.safetyStock,
          priority: workflowPriority(engine.status),
          reason,
          estimatedCost: engine.estimatedCost,
          updatedAt: now,
        });
      } else if (active === undefined) {
        await ctx.db.insert("reorderRecommendations", {
          storeId: row.storeId,
          productId: row.productId,
          status: "suggested",
          recommendedQty: engine.recommendedQty,
          leadTimeDemand,
          safetyStock: engine.safetyStock,
          priority: workflowPriority(engine.status),
          reason,
          estimatedCost: engine.estimatedCost,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("activityLog", {
          kind: "reorder_recommendation",
          message: `${engine.recommendedQty} units of ${product.name} recommended for ${storeById.get(row.storeId)?.code ?? "store"}`,
          storeId: row.storeId,
          productId: row.productId,
          createdAt: now,
        });
      }
      // approved/ordered rows are left untouched — the workflow owns them.
      upserted += 1;
    }

    return { upserted };
  },
});

/** Full recommendation list with joined names, newest activity first. */
export const listRecommendations = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(
      v.union(
        v.literal("suggested"),
        v.literal("approved"),
        v.literal("ordered"),
        v.literal("completed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const rows = args.status
      ? await ctx.db
          .query("reorderRecommendations")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("reorderRecommendations").collect();

    const stores = keyById(await ctx.db.query("stores").collect());
    const products = keyById(await ctx.db.query("products").collect());

    return rows
      .filter((row) => args.storeId === undefined || row.storeId === args.storeId)
      .map((row) => {
        const store = stores.get(row.storeId);
        const product = products.get(row.productId);
        return {
          id: row._id,
          storeId: row.storeId,
          storeCode: store?.code ?? "—",
          storeName: store?.name ?? "—",
          productId: row.productId,
          sku: product?.sku ?? "—",
          productName: product?.name ?? "—",
          status: row.status,
          recommendedQty: row.recommendedQty,
          approvedQty: row.approvedQty,
          leadTimeDemand: row.leadTimeDemand,
          safetyStock: row.safetyStock,
          priority: row.priority,
          reason: row.reason,
          estimatedCost: row.estimatedCost,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      })
      .sort((a, b) => {
        const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        const byPriority = rank[a.priority] - rank[b.priority];
        if (byPriority !== 0) return byPriority;
        return b.updatedAt - a.updatedAt;
      });
  },
});

/** Advance or edit a recommendation through the approval workflow. */
export const updateRecommendation = mutation({
  args: {
    id: v.id("reorderRecommendations"),
    action: v.union(
      v.literal("approve"),
      v.literal("update-qty"),
      v.literal("mark-ordered"),
      v.literal("mark-completed"),
      v.literal("dismiss"),
    ),
    qty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rec = await ctx.db.get(args.id);
    if (rec === null) {
      throw new Error("Recommendation not found");
    }
    const now = Date.now();
    const product = await ctx.db.get(rec.productId);
    const store = await ctx.db.get(rec.storeId);

    let status = rec.status;
    let approvedQty = rec.approvedQty;
    let recommendedQty = rec.recommendedQty;

    switch (args.action) {
      case "approve":
        status = "approved";
        approvedQty = args.qty ?? rec.recommendedQty;
        break;
      case "update-qty":
        if (args.qty === undefined || args.qty <= 0) {
          throw new Error("Quantity must be a positive number");
        }
        recommendedQty = Math.round(args.qty);
        approvedQty = Math.round(args.qty);
        break;
      case "mark-ordered":
        status = "ordered";
        break;
      case "mark-completed":
        status = "completed";
        break;
      case "dismiss":
        status = "completed";
        break;
    }

    await ctx.db.patch(rec._id, {
      status,
      approvedQty,
      recommendedQty,
      updatedAt: now,
    });

    const productLabel = product?.name ?? "product";
    const storeLabel = store?.code ?? "store";
    const messages: Record<typeof args.action, string> = {
      approve: `Reorder of ${productLabel} at ${storeLabel} approved`,
      "update-qty": `Reorder quantity for ${productLabel} at ${storeLabel} updated to ${recommendedQty}`,
      "mark-ordered": `Purchase order placed for ${productLabel} at ${storeLabel}`,
      "mark-completed": `Replenishment completed for ${productLabel} at ${storeLabel}`,
      dismiss: `Reorder suggestion for ${productLabel} at ${storeLabel} dismissed`,
    };
    await ctx.db.insert("activityLog", {
      kind: "order_status",
      message: messages[args.action],
      storeId: rec.storeId,
      productId: rec.productId,
      createdAt: now,
    });

    return { status };
  },
});

/**
 * Product detail payload for the inventory dialog: position, demand history,
 * model forecast and the engine's recommendation with its full reason.
 */
export const getProductDetail = query({
  args: {
    storeId: v.id("stores"),
    productId: v.id("products"),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const modelId =
      args.modelId !== undefined && isModelId(args.modelId)
        ? args.modelId
        : ("moving-average-7" as ModelId);
    const model = MODELS[modelId];

    const [product, store] = await Promise.all([
      ctx.db.get(args.productId),
      ctx.db.get(args.storeId),
    ]);
    if (product === null || store === null) return null;

    const position = await ctx.db
      .query("inventory")
      .withIndex("by_store_product", (q) =>
        q.eq("storeId", args.storeId).eq("productId", args.productId),
      )
      .first();

    const days = 60;
    const fromDate = isoDaysBefore(new Date(), days - 1);
    const sales = await ctx.db
      .query("dailySales")
      .withIndex("by_store_product", (q) =>
        q.eq("storeId", args.storeId).eq("productId", args.productId),
      )
      .collect();

    const totals = new Map<string, { units: number; revenue: number }>();
    for (const row of sales) {
      if (row.date < fromDate) continue;
      const entry = totals.get(row.date) ?? { units: 0, revenue: 0 };
      entry.units += row.unitsSold;
      entry.revenue += row.revenue;
      totals.set(row.date, entry);
    }

    const history: Array<{ date: string; units: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      const entry = totals.get(date);
      history.push({ date, units: entry?.units ?? 0 });
    }

    const series = history.map((p) => p.units);
    const forecastPoints = model.forecast(series, 14);
    const forecast = forecastPoints.map((units, i) => ({
      date: isoDaysBefore(new Date(), -(i + 1)),
      units,
    }));

    const engine = recommendReorder({
      currentStock: position?.onHand ?? 0,
      reserved: position?.reserved ?? 0,
      reorderPoint: product.reorderPoint,
      safetyStock: position?.safetyStock ?? 0,
      avgDaily: 0,
      demandHistory: series,
      unitCost: product.unitCost ?? product.unitPrice * 0.55,
    });

    return {
      product: {
        id: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit ?? "unit",
        unitPrice: product.unitPrice,
        unitCost: product.unitCost ?? Math.round(product.unitPrice * 0.55 * 100) / 100,
        reorderPoint: product.reorderPoint,
        active: product.active ?? true,
      },
      store: {
        id: store._id,
        code: store.code,
        name: store.name,
        city: store.city ?? "",
      },
      position: position
        ? {
            onHand: position.onHand,
            reserved: position.reserved,
            safetyStock: position.safetyStock ?? 0,
            updatedAt: position.updatedAt ?? Date.now(),
          }
        : null,
      recentSales: history.slice(-14).reverse(),
      forecast,
      recommendation: {
        recommendedQty: engine.recommendedQty,
        leadTimeDemand: engine.leadTimeDemand,
        safetyStock: engine.safetyStock,
        targetStock: engine.targetStock,
        priority: engine.priority,
        reason: engine.reason,
        estimatedCost: engine.estimatedCost,
      },
      generatedAt: toISODate(new Date()),
    };
  },
});
