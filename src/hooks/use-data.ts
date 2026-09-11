import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import type { RecommendationStatus } from "@/types/views";

/**
 * Data-access layer between Convex queries and the UI.
 *
 * Pages import hooks from here instead of calling `api.*` directly, so the
 * swap to the FastAPI backend later (TanStack Query + fetch) only touches
 * this file. Every hook returns `undefined` while loading — the pages own
 * the loading/empty/error states.
 */

/** All stores, sorted by code (scope filters, stores grid, admin). */
export function useStores() {
  return useQuery(api.inventory.listStores);
}

/** Flat position list (Inventory page + reports). Chain-wide when unscoped. */
export function usePositions(storeId?: string) {
  return useQuery(
    api.inventory.listPositions,
    storeId ? { storeId: storeId as Id<"stores"> } : {},
  );
}

export interface RecommendationFilter {
  status?: RecommendationStatus;
  storeId?: string;
}

/** Reorder recommendations (Orders, Stores detail, Reports). */
export function useRecommendations(filter: RecommendationFilter = {}) {
  return useQuery(api.reorders.listRecommendations, {
    status: filter.status,
    storeId: filter.storeId as Id<"stores"> | undefined,
  });
}

/** Mutations for the reorder workflow. Ids are Convex document ids. */
export function useRecommendationActions() {
  const refreshMutation = useMutation(api.reorders.refreshRecommendations);
  const updateMutation = useMutation(api.reorders.updateRecommendation);

  const refresh = useCallback(
    (args: { storeId?: string } = {}) =>
      refreshMutation({
        storeId: args.storeId as Id<"stores"> | undefined,
      }),
    [refreshMutation],
  );

  const update = useCallback(
    (args: {
      id: Id<"reorderRecommendations">;
      action:
        | "approve"
        | "update-qty"
        | "mark-ordered"
        | "mark-completed"
        | "dismiss";
      qty?: number;
    }) => updateMutation(args),
    [updateMutation],
  );

  return { refresh, update };
}

/** Workspace users for the Admin area. */
export function useAdminUsers() {
  return useQuery(api.ops.listUsers);
}

/** Recent operational events (dashboard activity, header notifications). */
export function useActivity(limit = 8) {
  return useQuery(api.ops.getActivity, { limit });
}

/** Store detail payload for `/stores/:storeId`. */
export function useStoreDetail(storeId?: string) {
  return useQuery(
    api.ops.getStoreDetail,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip",
  );
}

/** Per-store revenue/units/health for a window (Analytics, Stores, Reports). */
export function useStorePerformance(rangeDays = 30) {
  return useQuery(api.inventory.getStorePerformance, { rangeDays });
}

/** Daily revenue + units series, chain-wide or per store. */
export function useRevenueSeries(days = 90, storeId?: string) {
  return useQuery(api.analytics.getRevenueSeries, {
    days,
    storeId: storeId as Id<"stores"> | undefined,
  });
}

/** Revenue share by category for a window. */
export function useCategoryPerformance(rangeDays = 30) {
  return useQuery(api.analytics.getCategoryPerformance, { rangeDays });
}

/** Top products by revenue for a window. */
export function useTopProducts(rangeDays = 30, limit = 8) {
  return useQuery(api.analytics.getTopProducts, { rangeDays, limit });
}

/** Inventory analytics KPIs (value, turnover, health rates). */
export function useInventoryAnalytics() {
  return useQuery(api.analytics.getInventoryAnalytics, {});
}

/** Per-product demand drift signals (rising/declining demand). */
export function useDemandSignals() {
  return useQuery(api.inventory.getDemandSignals, {});
}

/**
 * Compact per-product forecast rows for the dashboard section (demo model,
 * shared with the Forecasting page).
 */
export function useProductForecasts(limit = 6) {
  return useQuery(api.forecasting.getProductForecasts, { limit });
}
