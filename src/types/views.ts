/**
 * Shared view-model types.
 *
 * These describe the data contracts between the data layer (Convex today,
 * FastAPI endpoints as the backend matures) and the UI. Keep them pure:
 * no React, no Convex runtime types.
 */

import type { StockStatus, ReorderPriority } from "../utils/reorder";

export type { StockStatus, ReorderPriority };

export type StoreStatus = "active" | "opening" | "closed";

export interface StoreView {
  id: string;
  code: string;
  name: string;
  city: string;
  status: StoreStatus;
}

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  reorderPoint: number;
}

export interface InventoryItemView {
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

export interface SalesTrendPoint {
  date: string;
  unitsSold: number;
  revenue: number;
}

export type HealthCounts = {
  healthy: number;
  low: number;
  critical: number;
  out: number;
  overstocked: number;
};

export interface InventoryHealthView {
  totals: {
    skuCount: number;
    storeCount: number;
    unitsOnHand: number;
    stockValue: number;
  };
  counts: HealthCounts;
}

export interface DashboardView {
  health: InventoryHealthView;
  lowStock: InventoryItemView[];
  salesTrend: SalesTrendPoint[];
  rangeDays: number;
  /** Revenue and units for the selected window… */
  revenue: number;
  unitsSold: number;
  /** …and for the preceding window of equal length (comparison baseline). */
  previousRevenue: number;
  previousUnitsSold: number;
  pendingRecommendations: number;
  generatedAt: string;
}

export interface StorePerformanceView {
  storeId: string;
  code: string;
  name: string;
  city: string;
  status: string;
  revenue: number;
  units: number;
  prevRevenue: number;
  lowStockCount: number;
  healthRate: number;
  stockoutRisk: number;
}

export interface DemandSignalView {
  productId: string;
  sku: string;
  name: string;
  category: string;
  trendPerDay: number;
  avgDaily: number;
}

export type RecommendationStatus = "suggested" | "approved" | "ordered" | "completed";

export interface RecommendationView {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  productId: string;
  sku: string;
  productName: string;
  status: RecommendationStatus;
  recommendedQty: number;
  approvedQty: number | undefined;
  leadTimeDemand: number;
  safetyStock: number;
  priority: ReorderPriority;
  reason: string;
  estimatedCost: number;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityItemView {
  id: string;
  kind: string;
  message: string;
  createdAt: number;
}
