import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin_users";

export const adminLogsTable = pgTable(
  "admin_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: text("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_logs_admin_id_idx").on(table.adminId),
    index("admin_logs_created_at_idx").on(table.createdAt),
    index("admin_logs_action_idx").on(table.action),
  ],
);

export type InsertAdminLog = typeof adminLogsTable.$inferInsert;
export type AdminLog = typeof adminLogsTable.$inferSelect;
