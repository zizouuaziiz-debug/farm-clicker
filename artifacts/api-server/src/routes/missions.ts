import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userMissionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { serializeUser } from "./auth.js";
import { getLevelForXp } from "../lib/game-config.js";

const router = Router();

const MISSION_TEMPLATES = [
  { missionType: "harvest_5", title: "Busy Farmer", description: "Harvest 5 crops", goal: 5, rewardCoins: 100, rewardXp: 50 },
  { missionType: "harvest_10", title: "Harvest Pro", description: "Harvest 10 crops", goal: 10, rewardCoins: 200, rewardXp: 100 },
  { missionType: "water_3", title: "Green Thumb", description: "Water 3 crops", goal: 3, rewardCoins: 75, rewardXp: 30 },
  { missionType: "buy_seeds_5", title: "Seed Hoarder", description: "Buy 5 seeds", goal: 5, rewardCoins: 50, rewardXp: 20 },
  { missionType: "earn_coins_500", title: "Coin Collector", description: "Earn 500 coins", goal: 500, rewardCoins: 150, rewardXp: 75 },
];

async function ensureDailyMissions(userId: number, date: string) {
  const existing = await db
    .select()
    .from(userMissionsTable)
    .where(and(eq(userMissionsTable.userId, userId), eq(userMissionsTable.missionDate, date)));

  if (existing.length > 0) return existing;

  // Create today's missions
  const values = MISSION_TEMPLATES.map((t) => ({
    userId,
    missionType: t.missionType,
    goal: t.goal,
    progress: 0,
    completed: false,
    claimed: false,
    missionDate: date,
    rewardCoins: t.rewardCoins,
    rewardXp: t.rewardXp,
  }));

  await db.insert(userMissionsTable).values(values);

  return db
    .select()
    .from(userMissionsTable)
    .where(and(eq(userMissionsTable.userId, userId), eq(userMissionsTable.missionDate, date)));
}

function serializeMission(m: typeof userMissionsTable.$inferSelect) {
  const template = MISSION_TEMPLATES.find((t) => t.missionType === m.missionType);
  return {
    id: m.id,
    title: template?.title ?? m.missionType,
    description: template?.description ?? "",
    missionType: m.missionType,
    goal: m.goal,
    progress: m.progress,
    completed: m.completed,
    claimed: m.claimed,
    reward: { coins: m.rewardCoins, xp: m.rewardXp },
  };
}

router.get("/", requireAuth, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const missions = await ensureDailyMissions(req.user!.id, today);
  res.json(missions.map(serializeMission));
});

/**
 * Increment progress on today's mission of the given type for a user, marking
 * it completed once the goal is reached. Called from gameplay routes
 * (harvest, water, shop) as the corresponding actions occur.
 */
export async function incrementMissionProgress(userId: number, missionType: string, amount: number) {
  const today = new Date().toISOString().slice(0, 10);
  await ensureDailyMissions(userId, today);

  const [mission] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionDate, today),
        eq(userMissionsTable.missionType, missionType),
      ),
    )
    .limit(1);

  if (!mission || mission.completed) return;

  const newProgress = Math.min(mission.goal, mission.progress + amount);
  await db
    .update(userMissionsTable)
    .set({ progress: newProgress, completed: newProgress >= mission.goal })
    .where(eq(userMissionsTable.id, mission.id));
}

router.post("/:id/claim", requireAuth, async (req, res) => {
  const user = req.user!;
  const id = parseInt(String(req.params.id), 10);

  const [mission] = await db
    .select()
    .from(userMissionsTable)
    .where(and(eq(userMissionsTable.id, id), eq(userMissionsTable.userId, user.id)))
    .limit(1);

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }
  if (!mission.completed) {
    res.status(400).json({ error: "Mission not completed yet" });
    return;
  }
  if (mission.claimed) {
    res.status(400).json({ error: "Reward already claimed" });
    return;
  }

  const newXp = user.xp + mission.rewardXp;
  const newCoins = user.coins + mission.rewardCoins;
  const newLevel = getLevelForXp(newXp);

  await db.transaction(async (tx) => {
    await tx.update(userMissionsTable).set({ claimed: true }).where(eq(userMissionsTable.id, id));
    await tx
      .update(usersTable)
      .set({
        xp: newXp,
        coins: newCoins,
        level: newLevel,
        totalCoinsEarned: user.totalCoinsEarned + mission.rewardCoins,
        totalXpEarned: user.totalXpEarned + mission.rewardXp,
      })
      .where(eq(usersTable.id, user.id));
  });

  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  res.json(serializeUser(updatedUser));
});

export default router;
