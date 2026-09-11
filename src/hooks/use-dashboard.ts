import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type {
  DashboardView,
  StoreView,
} from "@/types/views";

export type DashboardRange = 7 | 14 | 30;

export interface DashboardQueryArgs {
  /** Store document id as a plain string, or undefined for the whole chain. */
  storeId?: string;
  rangeDays?: DashboardRange;
}

/**
 * Reactive dashboard payload (health, low-stock, sales trend).
 *
 * The hook returns `undefined` while loading; the feature layer decides how
 * to render that state. Errors surface through Convex's own error handling.
 */
export function useDashboard(args: DashboardQueryArgs = {}) {
  return useQuery(api.inventory.getDashboardSummary, {
    storeId: args.storeId as Id<"stores"> | undefined,
    rangeDays: args.rangeDays,
  });
}

/** Stores for the dashboard scope filter. */
export function useStores(): StoreView[] | undefined {
  const stores = useQuery(api.inventory.listStores);
  return stores;
}
