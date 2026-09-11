import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
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

    // add other tables here

    // Retail locations in the chain.
    stores: defineTable({
      name: v.string(),
      code: v.string(),
      city: v.optional(v.string()),
    }).index("by_code", ["code"]),

    // Product catalog (one row per SKU).
    products: defineTable({
      sku: v.string(),
      name: v.string(),
      category: v.string(),
      unitPrice: v.number(),
      reorderPoint: v.number(),
    }).index("by_sku", ["sku"]),

    // Stock position per store per product.
    inventory: defineTable({
      storeId: v.id("stores"),
      productId: v.id("products"),
      onHand: v.number(),
      reserved: v.number(),
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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
