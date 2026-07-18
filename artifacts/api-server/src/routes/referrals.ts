import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Set once the bot is registered with @BotFather; without it we still return
// the raw code so the frontend can show/copy something, just not a t.me link.
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

router.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;

  const [{ value: invitedCount }] = await db
    .select({ value: count() })
    .from(usersTable)
    .where(eq(usersTable.referredById, user.id));

  const shareLink = BOT_USERNAME && user.referralCode
    ? `https://t.me/${BOT_USERNAME}?startapp=ref_${user.referralCode}`
    : null;

  res.json({
    referralCode: user.referralCode,
    shareLink,
    invitedCount,
    referralBonusCoinsEarned: user.referralBonusCoinsEarned,
  });
});

export default router;
