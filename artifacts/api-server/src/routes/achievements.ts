import { Router } from "express";
import { db } from "@workspace/db";
import { userAchievementsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

type User = typeof usersTable.$inferSelect;

const ACHIEVEMENTS = [
  { id: "first_harvest", title: "First Harvest", description: "Harvest your first crop", emoji: "🌾", category: "farming", goal: 1, checkFn: (u: User) => u.totalHarvests >= 1 },
  { id: "harvest_10", title: "10 Harvests", description: "Harvest 10 crops", emoji: "🏆", category: "farming", goal: 10, checkFn: (u: User) => u.totalHarvests >= 10 },
  { id: "harvest_100", title: "100 Harvests", description: "Harvest 100 crops", emoji: "🥇", category: "farming", goal: 100, checkFn: (u: User) => u.totalHarvests >= 100 },
  { id: "harvest_500", title: "500 Harvests", description: "Harvest 500 crops", emoji: "💫", category: "farming", goal: 500, checkFn: (u: User) => u.totalHarvests >= 500 },
  { id: "level_5", title: "Level 5", description: "Reach level 5", emoji: "⭐", category: "progress", goal: 5, checkFn: (u: User) => u.level >= 5 },
  { id: "level_10", title: "Level 10", description: "Reach level 10", emoji: "🌟", category: "progress", goal: 10, checkFn: (u: User) => u.level >= 10 },
  { id: "coins_1000", title: "Coin Saver", description: "Accumulate 1,000 coins", emoji: "💰", category: "wealth", goal: 1000, checkFn: (u: User) => u.coins >= 1000 },
  { id: "coins_10000", title: "Rich Farmer", description: "Accumulate 10,000 coins", emoji: "💎", category: "wealth", goal: 10000, checkFn: (u: User) => u.coins >= 10000 },
  { id: "streak_7", title: "Week Streak", description: "7 day login streak", emoji: "🔥", category: "daily", goal: 7, checkFn: (u: User) => u.currentStreak >= 7 },
  { id: "streak_30", title: "Month Streak", description: "30 day login streak", emoji: "🌈", category: "daily", goal: 30, checkFn: (u: User) => u.currentStreak >= 30 },
  { id: "wheat_master", title: "Wheat Master", description: "Harvest 100 wheat", emoji: "🌾", category: "crops", goal: 100, checkFn: (u: User) => u.cropsHarvestedWheat >= 100 },
  { id: "tomato_master", title: "Tomato Master", description: "Harvest 50 tomatoes", emoji: "🍅", category: "crops", goal: 50, checkFn: (u: User) => u.cropsHarvestedTomato >= 50 },
  { id: "potato_master", title: "Potato Master", description: "Harvest 30 potatoes", emoji: "🥔", category: "crops", goal: 30, checkFn: (u: User) => u.cropsHarvestedPotato >= 30 },
];

router.get("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const unlocked = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, user.id));

  const unlockedIds = new Set(unlocked.map((a) => a.achievementId));

  // Check for newly unlocked achievements
  const toUnlock = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id) && a.checkFn(user));
  if (toUnlock.length > 0) {
    await db.insert(userAchievementsTable).values(
      toUnlock.map((a) => ({ userId: user.id, achievementId: a.id }))
    );
    for (const a of toUnlock) { unlockedIds.add(a.id); }
  }

  const unlockedMap = new Map(unlocked.map((a) => [a.achievementId, a]));

  res.json(
    ACHIEVEMENTS.map((a) => {
      const ua = unlockedMap.get(a.id);
      const progress = a.checkFn(user)
        ? a.goal
        : Math.min(a.goal, getUserProgress(user, a.id));
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        emoji: a.emoji,
        category: a.category,
        unlocked: unlockedIds.has(a.id),
        unlockedAt: ua?.unlockedAt?.toISOString() || null,
        progress,
        goal: a.goal,
      };
    })
  );
});

function getUserProgress(user: User, achievementId: string): number {
  switch (achievementId) {
    case "first_harvest": case "harvest_10": case "harvest_100": case "harvest_500": return user.totalHarvests;
    case "level_5": case "level_10": return user.level;
    case "coins_1000": case "coins_10000": return user.coins;
    case "streak_7": case "streak_30": return user.currentStreak;
    case "wheat_master": return user.cropsHarvestedWheat;
    case "tomato_master": return user.cropsHarvestedTomato;
    case "potato_master": return user.cropsHarvestedPotato;
    default: return 0;
  }
}

export default router;
