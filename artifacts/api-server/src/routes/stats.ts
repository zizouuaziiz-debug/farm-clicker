import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const createdAt = user.createdAt;
  const now = new Date();
  const daysSinceJoined = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    totalHarvests: user.totalHarvests,
    totalWatered: user.totalWatered,
    totalCoinsEarned: user.totalCoinsEarned,
    totalCoinsSent: 0,
    totalXpEarned: user.totalXpEarned,
    cropsHarvestedByType: {
      wheat: user.cropsHarvestedWheat,
      sunflower: user.cropsHarvestedSunflower,
      tomato: user.cropsHarvestedTomato,
      carrot: user.cropsHarvestedCarrot,
      potato: user.cropsHarvestedPotato,
      corn: user.cropsHarvestedCorn,
    },
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    daysSinceJoined,
    level: user.level,
  });
});

export default router;
