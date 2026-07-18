import { pgTable, text, serial, integer, timestamp, boolean, index, unique, type AnyPgColumn, numeric } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramId: text("telegram_id").notNull().unique(),
    username: text("username").notNull(),
    // Short shareable code, e.g. "F0007". Backfilled from `id` right after insert
    // (see auth.ts) since the id isn't known until the row exists.
    referralCode: text("referral_code"),
    // Who invited this user, set exactly once at account creation and never
    // changed afterwards — this is what makes the signup bonus impossible to
    // grant twice for the same invitee.
    referredById: integer("referred_by_id").references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
    // Cumulative coins this user has earned from people who signed up with
    // their referral code (for display on the referrals page).
    referralBonusCoinsEarned: integer("referral_bonus_coins_earned").notNull().default(0),
    firstName: text("first_name"),
    lastName: text("last_name"),
    photoUrl: text("photo_url"),
    coins: integer("coins").notNull().default(200),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    energy: integer("energy").notNull().default(50),
    maxEnergy: integer("max_energy").notNull().default(50),
    energyRegenAt: timestamp("energy_regen_at", { withTimezone: true }),
    vipLevel: integer("vip_level").notNull().default(0),
    vipExpiresAt: timestamp("vip_expires_at", { withTimezone: true }),
    totalHarvests: integer("total_harvests").notNull().default(0),
    totalCoinsEarned: integer("total_coins_earned").notNull().default(0),
    totalXpEarned: integer("total_xp_earned").notNull().default(0),
    totalWatered: integer("total_watered").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    currentStreak: integer("current_streak").notNull().default(0),
    lastDailyClaimAt: timestamp("last_daily_claim_at", { withTimezone: true }),
    dailyClaimDay: integer("daily_claim_day").notNull().default(0),
    lastAdEnergyClaimAt: timestamp("last_ad_energy_claim_at", { withTimezone: true }),
    lastAdBonusClaimAt: timestamp("last_ad_bonus_claim_at", { withTimezone: true }),
    lastAdDailyDoubleAt: timestamp("last_ad_daily_double_at", { withTimezone: true }),
    cropsHarvestedWheat: integer("crops_harvested_wheat").notNull().default(0),
    cropsHarvestedTomato: integer("crops_harvested_tomato").notNull().default(0),
    cropsHarvestedPotato: integer("crops_harvested_potato").notNull().default(0),
    cropsHarvestedSunflower: integer("crops_harvested_sunflower").notNull().default(0),
    cropsHarvestedCarrot: integer("crops_harvested_carrot").notNull().default(0),
    cropsHarvestedCorn: integer("crops_harvested_corn").notNull().default(0),
    usdtBalance: numeric("usdt_balance", { precision: 12, scale: 2 }).notNull().default("0"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // Leaderboard: fast ordered scan by coins descending
    index("users_coins_idx").on(table.coins),
    // Level-based queries
    index("users_level_idx").on(table.level),
    // Ban/admin status checks
    index("users_is_banned_idx").on(table.isBanned),
    // Referral code lookups (resolving a shared link) and uniqueness.
    unique("users_referral_code_unique").on(table.referralCode),
    // "Who did this user invite" listings.
    index("users_referred_by_id_idx").on(table.referredById),
  ],
);

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
