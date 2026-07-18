import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { serializeUser } from "./auth.js";
import { DAILY_REWARDS, getLevelForXp } from "../lib/game-config.js";

const router = Router();

function getDailyStatus(user: typeof usersTable.$inferSelect) {
  const today = new Date().toISOString().slice(0, 10);
  const lastClaim = user.lastDailyClaimAt?.toISOString().slice(0, 10);
  const claimed = lastClaim === today;
  const day = ((user.dailyClaimDay - 1 + 7) % 7); // 0-based index for rewards
  const nextDay = (user.dailyClaimDay % 7); // 0-based for next
  return {
    day: user.dailyClaimDay,
    claimed,
    streak: user.currentStreak,
    reward: DAILY_REWARDS[day] ?? DAILY_REWARDS[0],
    nextReward: DAILY_REWARDS[nextDay] ?? DAILY_REWARDS[0],
  };
}

router.get("/reward", requireAuth, async (req, res) => {
  res.json(getDailyStatus(req.user!));
});

router.post("/claim", requireAuth, async (req, res) => {
  const user = req.user!;
  const today = new Date().toISOString().slice(0, 10);
  const lastClaim = user.lastDailyClaimAt?.toISOString().slice(0, 10);

  if (lastClaim === today) {
    res.status(400).json({ error: "Already claimed today" });
    return;
  }

  const rewardIndex = user.dailyClaimDay % 7;
  const reward = DAILY_REWARDS[rewardIndex] ?? DAILY_REWARDS[0];

  // Streak logic
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const newStreak = lastClaim === yesterdayStr ? user.currentStreak + 1 : 1;
  const longestStreak = Math.max(user.longestStreak, newStreak);

  const newXp = user.xp + reward.xp;
  const newCoins = user.coins + reward.coins;
  const newLevel = getLevelForXp(newXp);
  const newDay = (user.dailyClaimDay % 7) + 1;

  const [updated] = await db
    .update(usersTable)
    .set({
      coins: newCoins,
      xp: newXp,
      level: newLevel,
      lastDailyClaimAt: new Date(),
      dailyClaimDay: newDay,
      currentStreak: newStreak,
      longestStreak,
      totalCoinsEarned: user.totalCoinsEarned + reward.coins,
      totalXpEarned: user.totalXpEarned + reward.xp,
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({
    day: updated.dailyClaimDay,
    streak: updated.currentStreak,
    reward,
    user: serializeUser(updated),
  });
});

export default router;
