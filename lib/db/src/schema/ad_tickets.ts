import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Ad placements that reward the player. Kept as a plain text column (not a
// pg enum) so adding a new placement never requires a migration.
export const AD_PLACEMENTS = ["energy", "bonus", "daily_double"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

// Server-issued, single-use, short-lived tickets that gate ad rewards.
//
// Adsgram (like most ad networks aimed at Telegram Mini Apps) has no public
// server-to-server postback for verifying that an ad was actually watched —
// completion is only known client-side. A ticket is the mitigation: the
// server decides *eligibility* (cooldowns) and issues a random token before
// the ad plays; the client must present that exact token to claim the
// reward, and each token can be claimed exactly once before it expires.
// This does not "prove" the ad played, but it does close the two cheapest
// abuse vectors: replaying a single successful claim indefinitely, and
// claiming a reward without ever requesting a ticket at all.
export const adTicketsTable = pgTable(
  "ad_tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    placement: text("placement", { enum: AD_PLACEMENTS }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    index("ad_tickets_user_id_idx").on(table.userId),
    // Sweeping/looking up unclaimed-but-expired tickets for cleanup.
    index("ad_tickets_expires_at_idx").on(table.expiresAt),
  ],
);

export type InsertAdTicket = typeof adTicketsTable.$inferInsert;
export type AdTicket = typeof adTicketsTable.$inferSelect;
