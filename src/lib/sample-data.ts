import { hashSeed, mulberry32 } from "@/utils/deterministic";
import { isoDaysBefore, toISODate } from "@/utils/date";

/**
 * Sample chain-store dataset for version 1.
 *
 * Hand-curated catalog (realistic names/prices) with deterministically
 * generated sales and inventory so every environment shows the same demo.
 * Generated only by the Convex seed function; see src/convex/seed.ts.
 */

export const SALES_DAYS = 84; // twelve weeks of history
export const SAMPLE_SEED = 7;

export interface SampleStore {
  code: string;
  name: string;
  city: string;
}

export interface SampleProduct {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  reorderPoint: number;
}

export interface SampleDailySales {
  date: string;
  unitsSold: number;
  revenue: number;
}

export interface SampleInventoryItem {
  onHand: number;
  reserved: number;
}

export const SAMPLE_STORES: SampleStore[] = [
  { code: "DTC-01", name: "Downtown Flagship", city: "Lisbon" },
  { code: "RIV-02", name: "Riverside Market", city: "Porto" },
  { code: "NSH-03", name: "Northshore Plaza", city: "Braga" },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { sku: "CB-ESP-250", name: "Espresso Blend 250g", category: "Coffee", unitPrice: 12.5, reorderPoint: 24 },
  { sku: "CB-FIL-250", name: "House Filter 250g", category: "Coffee", unitPrice: 9.8, reorderPoint: 18 },
  { sku: "CB-SIN-1KG", name: "Single Origin 1kg", category: "Coffee", unitPrice: 34.0, reorderPoint: 10 },
  { sku: "AC-CUP-12", name: "Ceramic Cup (12-pack)", category: "Accessories", unitPrice: 48.0, reorderPoint: 6 },
  { sku: "AC-KET-01", name: "Pour-over Kettle", category: "Accessories", unitPrice: 65.0, reorderPoint: 4 },
  { sku: "AC-SCL-01", name: "Brew Scale", category: "Accessories", unitPrice: 89.0, reorderPoint: 3 },
  { sku: "SN-MUG-01", name: "Diner Mug", category: "Merch", unitPrice: 14.0, reorderPoint: 12 },
  { sku: "SN-TEE-02", name: "Crew T-shirt", category: "Merch", unitPrice: 22.0, reorderPoint: 10 },
  { sku: "SN-TEE-03", name: "Logo Hoodie", category: "Merch", unitPrice: 45.0, reorderPoint: 8 },
  { sku: "SN-TOT-01", name: "Canvas Tote", category: "Merch", unitPrice: 18.0, reorderPoint: 14 },
  { sku: "FD-COK-12", name: "Cookie Box (12-pack)", category: "Food", unitPrice: 21.0, reorderPoint: 20 },
  { sku: "FD-GRN-08", name: "Granola Bag 400g", category: "Food", unitPrice: 7.5, reorderPoint: 26 },
];
