import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  VIEWER: "viewer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.VIEWER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ------------------------------------------------------------------
    // StockPilot domain tables
    // ------------------------------------------------------------------

    // Retail locations in the chain.
    stores: defineTable({
      name: v.string(),
      code: v.string(),
      city: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("opening"), v.literal("closed"))),
      createdAt: v.optional(v.string()),
    }).index("by_code", ["code"]),

    // Product catalog (one row per SKU).
    products: defineTable({
      sku: v.string(),
      name: v.string(),
      category: v.string(),
      unit: v.optional(v.string()),
      unitPrice: v.number(),
      unitCost: v.optional(v.number()),
      reorderPoint: v.number(),
      active: v.optional(v.boolean()),
    }).index("by_sku", ["sku"]),

    // Stock position per store per product.
    inventory: defineTable({
      storeId: v.id("stores"),
      productId: v.id("products"),
      onHand: v.number(),
      reserved: v.number(),
      safetyStock: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
      .index("by_store", ["storeId"])
      .index("by_product", ["productId"])
      .index("by_store_product", ["storeId", "productId"]),

    // Daily aggregated sales per store per product (YYYY-MM-DD keys).
    dailySales: defineTable({
      storeId: v.id("stores"),
      productId: v.id("products"),
      date: v.string(),
      unitsSold: v.number(),
      revenue: v.number(),
    })
      .index("by_store_date", ["storeId", "date"])
      .index("by_product", ["productId"]),

    // Persisted reorder recommendations and their approval workflow state.
    reorderRecommendations: defineTable({
      storeId: v.id("stores"),
      productId: v.id("products"),
      status: v.union(
        v.literal("suggested"),
        v.literal("approved"),
        v.literal("ordered"),
        v.literal("completed"),
      ),
      recommendedQty: v.number(),
      approvedQty: v.optional(v.number()),
      leadTimeDemand: v.number(),
      safetyStock: v.number(),
      priority: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      reason: v.string(),
      estimatedCost: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_store", ["storeId"])
      .index("by_store_product", ["storeId", "productId"]),

    // Operational activity feed (alerts, recommendations, updates, forecasts).
    activityLog: defineTable({
      kind: v.union(
        v.literal("stock_alert"),
        v.literal("reorder_recommendation"),
        v.literal("inventory_update"),
        v.literal("forecast_generated"),
        v.literal("order_status"),
      ),
      message: v.string(),
      storeId: v.optional(v.id("stores")),
      productId: v.optional(v.id("products")),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
