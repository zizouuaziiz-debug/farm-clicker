import { pgTable, serial, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userAchievementsTable = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_achievements_user_id_idx").on(table.userId),
    // Each achievement can only be unlocked once per user.
    unique("user_achievements_user_achievement_unique").on(table.userId, table.achievementId),
  ],
);

export type InsertUserAchievement = typeof userAchievementsTable.$inferInsert;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;
