import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const depositsTable = pgTable(
  "deposits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    txHash: text("tx_hash").notNull(),
    amountUsdt: numeric("amount_usdt", { precision: 10, scale: 2 }).notNull(),
    coinsCredit: integer("coins_credit").notNull().default(0),
    // pending | completed | failed
    status: text("status").notNull().default("pending"),
    failReason: text("fail_reason"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("deposits_tx_hash_unique").on(table.txHash),
    index("deposits_user_id_idx").on(table.userId),
    index("deposits_status_idx").on(table.status),
    index("deposits_created_at_idx").on(table.createdAt),
  ],
);

export type InsertDeposit = typeof depositsTable.$inferInsert;
export type Deposit = typeof depositsTable.$inferSelect;
