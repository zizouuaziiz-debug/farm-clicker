import { pgTable, serial, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const inventoryTable = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    quantity: integer("quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("inventory_user_id_idx").on(table.userId),
    // One row per (user, item) — shop.ts/farm.ts select-then-update-or-insert relies on this.
    unique("inventory_user_item_unique").on(table.userId, table.itemType),
  ],
);

export type InsertInventory = typeof inventoryTable.$inferInsert;
export type Inventory = typeof inventoryTable.$inferSelect;
