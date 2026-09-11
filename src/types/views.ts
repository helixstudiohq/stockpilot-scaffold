/**
 * Shared view-model types.
 *
 * These describe the data contracts between the data layer (Convex today,
 * FastAPI endpoints as the backend matures) and the UI. Keep them pure:
 * no React, no Convex runtime types.
 */

import type { StockStatus, StockStatusRank } from "../utils/inventory";

export type { StockStatus, StockStatusRank };

export interface StoreView {
  id: string;
  code: string;
  name: string;
  city: string;
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

export interface InventoryHealthView {
  totals: {
    skuCount: number;
    storeCount: number;
    unitsOnHand: number;
    stockValue: number;
  };
  counts: {
    healthy: number;
    low: number;
    out: number;
  };
}

export interface DashboardView {
  health: InventoryHealthView;
  lowStock: InventoryItemView[];
  salesTrend: SalesTrendPoint[];
  rangeDays: number;
  generatedAt: string;
}
