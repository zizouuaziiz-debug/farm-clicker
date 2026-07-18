import { pgTable, text, serial, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const plotsTable = pgTable(
  "plots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    state: text("state").notNull().default("empty"),
    cropType: text("crop_type"),
    plantedAt: timestamp("planted_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    wateredAt: timestamp("watered_at", { withTimezone: true }),
    waterStage: integer("water_stage").notNull().default(0),
    witheredAt: timestamp("withered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("plots_user_id_idx").on(table.userId),
    // One plot per (user, slot) — matches getOrCreatePlots' assumption in farm.ts.
    unique("plots_user_slot_unique").on(table.userId, table.slot),
  ],
);

export type InsertPlot = typeof plotsTable.$inferInsert;
export type Plot = typeof plotsTable.$inferSelect;
