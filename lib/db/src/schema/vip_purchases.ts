import { pgTable, serial, integer, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const vipPurchasesTable = pgTable(
  "vip_purchases",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tier: integer("tier").notNull(),
    tierName: text("tier_name"),
    priceUsdt: numeric("price_usdt", { precision: 10, scale: 2 }).notNull(),
    durationDays: integer("duration_days").notNull(),
    txHash: text("tx_hash").notNull(),
    walletSent: text("wallet_sent").notNull(),
    screenshotUrl: text("screenshot_url"),
    status: text("status").notNull().default("pending"),
    rejectReason: text("reject_reason"),
    adminNotes: text("admin_notes"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("vip_purchases_user_id_idx").on(table.userId),
    index("vip_purchases_status_idx").on(table.status),
    index("vip_purchases_created_at_idx").on(table.createdAt),
  ],
);

export type InsertVipPurchase = typeof vipPurchasesTable.$inferInsert;
export type VipPurchase = typeof vipPurchasesTable.$inferSelect;
