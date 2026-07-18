import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { parsePagination } from "../lib/pagination.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { limit } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });
  // Select only the columns the leaderboard actually renders, instead of the
  // full user row, to cut payload size and DB→server transfer.
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      firstName: usersTable.firstName,
      photoUrl: usersTable.photoUrl,
      coins: usersTable.coins,
      level: usersTable.level,
      totalHarvests: usersTable.totalHarvests,
      vipLevel: usersTable.vipLevel,
    })
    .from(usersTable)
    .where(eq(usersTable.isBanned, false))
    .orderBy(desc(usersTable.coins))
    .limit(limit);

  res.json(
    users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      username: u.username,
      firstName: u.firstName,
      photoUrl: u.photoUrl,
      coins: u.coins,
      level: u.level,
      totalHarvests: u.totalHarvests,
      vipLevel: u.vipLevel,
    }))
  );
});

export default router;
