import {
  pgTable,
  bigint,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { broadcastsTable } from "./broadcasts";
import { usersTable } from "./users";

export const broadcastSentTable = pgTable(
  "broadcast_sent",
  {
    id: bigint("id", {
      mode: "number",
    })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    broadcastId: integer("broadcast_id")
      .references(() => broadcastsTable.id, {
        onDelete: "cascade",
      }),

    userId: integer("user_id")
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    // sent | failed
    status: text("status"),

    error: text("error"),

    sentAt: timestamp("sent_at", { withTimezone: true })
      .defaultNow(),
  },
  (table) => [
    index("broadcast_sent_broadcast_id_idx")
      .on(table.broadcastId),

    index("broadcast_sent_user_id_idx")
      .on(table.userId),
  ],
);

export type InsertBroadcastSent =
  typeof broadcastSentTable.$inferInsert;

export type BroadcastSent =
  typeof broadcastSentTable.$inferSelect;
