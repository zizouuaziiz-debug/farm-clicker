import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userMissionsTable = pgTable(
  "user_missions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    missionType: text("mission_type").notNull(),
    goal: integer("goal").notNull(),
    progress: integer("progress").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    claimed: boolean("claimed").notNull().default(false),
    missionDate: text("mission_date").notNull(),
    rewardCoins: integer("reward_coins").notNull().default(0),
    rewardXp: integer("reward_xp").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // Also serves lookups filtered by (user_id, mission_date) via the leading columns.
    unique("user_missions_user_date_type_unique").on(table.userId, table.missionDate, table.missionType),
  ],
);

export type InsertUserMission = typeof userMissionsTable.$inferInsert;
export type UserMission = typeof userMissionsTable.$inferSelect;
