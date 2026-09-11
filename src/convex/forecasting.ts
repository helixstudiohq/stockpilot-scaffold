import { query } from "./_generated/server";
import { v } from "convex/values";
import { keyById } from "../lib/convex-helpers";
import { isoDaysBefore, toISODate } from "../utils/date";
import {
  DEFAULT_MODEL,
  MODELS,
  bandHalfWidth,
  evaluateModel,
  type ModelId,
} from "../utils/forecasting";
import { LEAD_TIME_DAYS } from "../utils/reorder";

/**
 * Forecasting data service.
 *
 * Model logic lives in src/utils/forecasting.ts (pure, UI-free); this module
 * only fetches demand history, runs the selected model and returns the data
 * the Forecasting page and dashboard forecast section render.
 *
 * Everything here is computed on the deterministic demo dataset — the results
 * are simulated forecasting for portfolio purposes, not production predictions.
 */

const HISTORY_DAYS = 60;
const FORECAST_HORIZON = 14;

function isModelId(value: string): value is ModelId {
  return value in MODELS;
}

/** Historical daily demand for one product across the whole chain. */
export const getProductDemand = query({
  args: {
    productId: v.optional(v.id("products")),
    historyDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    const target =
      (args.productId !== undefined
        ? products.find((p) => p._id === args.productId)
        : products[0]) ?? null;
    if (target === null) {
      return null;
    }

    const days = Math.min(Math.max(args.historyDays ?? HISTORY_DAYS, 14), 120);
    const fromDate = isoDaysBefore(new Date(), days - 1);

    const sales = await ctx.db
      .query("dailySales")
      .withIndex("by_product", (q) => q.eq("productId", target._id))
      .collect();

    const totals = new Map<string, number>();
    for (const row of sales) {
      if (row.date < fromDate) continue;
      totals.set(row.date, (totals.get(row.date) ?? 0) + row.unitsSold);
    }

    const history: Array<{ date: string; units: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      history.push({ date, units: totals.get(date) ?? 0 });
    }

    return {
      product: {
        id: target._id,
        sku: target.sku,
        name: target.name,
        category: target.category,
        unitPrice: target.unitPrice,
      },
      history,
    };
  },
});

/**
 * Full forecast payload for the Forecasting page: history, forecast points
 * with a confidence band derived from backtest error, and accuracy metrics.
 */
export const getForecast = query({
  args: {
    productId: v.optional(v.id("products")),
    modelId: v.optional(v.string()),
    horizon: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    const target =
      (args.productId !== undefined
        ? products.find((p) => p._id === args.productId)
        : products[0]) ?? null;
    if (target === null) {
      return null;
    }

    const modelId =
      args.modelId !== undefined && isModelId(args.modelId)
        ? args.modelId
        : DEFAULT_MODEL;
    const model = MODELS[modelId];
    const horizon = Math.min(Math.max(args.horizon ?? FORECAST_HORIZON, 7), 30);

    const fromDate = isoDaysBefore(new Date(), HISTORY_DAYS - 1);
    const sales = await ctx.db
      .query("dailySales")
      .withIndex("by_product", (q) => q.eq("productId", target._id))
      .collect();

    const totals = new Map<string, number>();
    for (const row of sales) {
      if (row.date < fromDate) continue;
      totals.set(row.date, (totals.get(row.date) ?? 0) + row.unitsSold);
    }

    const history: Array<{ date: string; units: number }> = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const date = isoDaysBefore(new Date(), i);
      history.push({ date, units: totals.get(date) ?? 0 });
    }
    const series = history.map((p) => p.units);

    const points = model.forecast(series, horizon);
    const halfWidth = bandHalfWidth(series, model);
    const metrics = evaluateModel(series, model);

    const today = toISODate(new Date());
    const forecast: Array<{
      date: string;
      units: number;
      lower: number;
      upper: number;
    }> = points.map((units, i) => ({
      date: isoDaysBefore(new Date(), -(i + 1)),
      units,
      lower: Math.max(0, Math.round(units - halfWidth)),
      upper: Math.round(units + halfWidth),
    }));

    return {
      product: {
        id: target._id,
        sku: target.sku,
        name: target.name,
        category: target.category,
        unitPrice: target.unitPrice,
      },
      model: {
        id: model.id,
        label: model.label,
        description: model.description,
      },
      horizon,
      history,
      forecast,
      metrics,
      halfWidth,
      leadTimeDays: LEAD_TIME_DAYS,
      generatedAt: today,
    };
  },
});

/**
 * Compact per-product forecast for the dashboard section: predicted daily
 * demand, horizon and confidence, all from the same shared model code.
 */
export const getProductForecasts = query({
  args: {
    modelId: v.optional(v.string()),
    horizon: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const modelId =
      args.modelId !== undefined && isModelId(args.modelId)
        ? args.modelId
        : DEFAULT_MODEL;
    const model = MODELS[modelId];
    const horizon = Math.min(Math.max(args.horizon ?? FORECAST_HORIZON, 7), 30);
    const limit = Math.min(Math.max(args.limit ?? 6, 1), 12);

    const products = await ctx.db.query("products").collect();
    const sales = await ctx.db.query("dailySales").collect();

    const fromDate = isoDaysBefore(new Date(), HISTORY_DAYS - 1);
    const byProduct = new Map<string, Map<string, number>>();
    for (const row of sales) {
      if (row.date < fromDate) continue;
      const totals = byProduct.get(row.productId) ?? new Map<string, number>();
      totals.set(row.date, (totals.get(row.date) ?? 0) + row.unitsSold);
      byProduct.set(row.productId, totals);
    }

    const results: Array<{
      productId: string;
      sku: string;
      name: string;
      category: string;
      currentStock: number;
      predictedDaily: number;
      horizonDays: number;
      predictedTotal: number;
      mape: number | null;
    }> = [];

    for (const product of products) {
      const totals = byProduct.get(product._id);
      if (totals === undefined) continue;

      const history: number[] = [];
      for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
        const date = isoDaysBefore(new Date(), i);
        history.push(totals.get(date) ?? 0);
      }

      const points = model.forecast(history, horizon);
      const metrics = evaluateModel(history, model, 10);
      const predictedTotal = Math.round(points.reduce((s, v) => s + v, 0));

      // Current chain-wide stock for this product.
      const inventory = await ctx.db
        .query("inventory")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      const currentStock = inventory.reduce((sum, row) => sum + row.onHand, 0);

      results.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        currentStock,
        predictedDaily: Math.round((predictedTotal / horizon) * 10) / 10,
        horizonDays: horizon,
        predictedTotal,
        mape: metrics.mape,
      });
    }

    // Highest predicted demand first — the products that matter most.
    results.sort((a, b) => b.predictedTotal - a.predictedTotal);
    return results.slice(0, limit);
  },
});
