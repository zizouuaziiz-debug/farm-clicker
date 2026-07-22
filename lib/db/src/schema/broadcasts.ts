import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin_users";

export const broadcastsTable = pgTable(
  "broadcasts",
  {
    id: serial("id").primaryKey(),

    message: text("message").notNull(),

    parseMode: text("parse_mode")
      .default("HTML"),

    target: text("target")
      .default("all"),

    // pending | running | completed
    status: text("status")
      .default("pending"),

    totalUsers: integer("total_users")
      .default(0),

    successCount: integer("success_count")
      .default(0),

    failedCount: integer("failed_count")
      .default(0),

    createdBy: integer("created_by")
      .references(() => adminUsersTable.id, {
        onDelete: "set null",
      }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow(),

    startedAt: timestamp("started_at", { withTimezone: true }),

    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("broadcasts_status_idx").on(table.status),
    index("broadcasts_created_at_idx").on(table.createdAt),
  ],
);

export type InsertBroadcast = typeof broadcastsTable.$inferInsert;
export type Broadcast = typeof broadcastsTable.$inferSelect;
