import { pgTable, serial, integer, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const withdrawalsTable = pgTable(
  "withdrawals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    coinsAmount: integer("coins_amount").notNull(),
    usdtAmount: numeric("usdt_amount", { precision: 10, scale: 2 }).notNull(),
    usdtWallet: text("usdt_wallet").notNull(),
    network: text("network").notNull().default("TRC20"),
    status: text("status").notNull().default("pending"),
    txHash: text("tx_hash"),
    rejectReason: text("reject_reason"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("withdrawals_user_id_idx").on(table.userId),
    index("withdrawals_status_idx").on(table.status),
    index("withdrawals_created_at_idx").on(table.createdAt),
  ],
);

export type InsertWithdrawal = typeof withdrawalsTable.$inferInsert;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
