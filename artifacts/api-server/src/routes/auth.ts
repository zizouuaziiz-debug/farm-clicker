import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { validateTelegramInitData, signJwt } from "../lib/auth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { logger } from "../lib/logger.js";
import { REFERRAL_SIGNUP_BONUS_COINS, REFERRAL_INVITER_BONUS_COINS } from "../lib/game-config.js";

const IS_DEV = process.env.NODE_ENV !== "production";

const telegramSchema = z.object({
  initData: z.string().min(1, "initData is required"),
  // Telegram deep-link start_param, e.g. "ref_F1A2B3". Only used the first
  // time a given telegramId ever authenticates (i.e. account creation).
  referralCode: z.string().trim().max(64).optional(),
});

// Derives a short, stable, shareable referral code from a user's numeric id.
// Base36 keeps it compact; there is no collision risk because ids are unique
// serial primary keys, so no uniqueness retry loop is needed.
function referralCodeFromId(id: number): string {
  return `F${id.toString(36).toUpperCase()}`;
}

const router = Router();

router.post("/telegram", validateBody(telegramSchema), async (req, res) => {
  try {
    const { initData, referralCode: rawReferralCode } = req.body as { initData?: string; referralCode?: string };

    if (!initData || typeof initData !== "string") {
      return res.status(400).json({ error: "initData is required" });
    }

    // Deep links look like https://t.me/bot?startapp=ref_F1A2B3 — strip an
    // optional "ref_" prefix so both the raw code and the full start_param work.
    const referralCode = rawReferralCode?.replace(/^ref_/, "").trim().toUpperCase() || undefined;

    const parsed = validateTelegramInitData(initData);

    if (!parsed || !parsed.user) {
      return res.status(401).json({ error: "Invalid Telegram initData" });
    }

    const tgUser = parsed.user;
    const telegramId = String(tgUser.id);
    const username = tgUser.username || null;
    let existingUser: typeof usersTable.$inferSelect | undefined;

    try {
      [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.telegramId, telegramId))
        .limit(1);
    } catch (error) {
      logger.error({ err: error }, "Database query during auth");
      return res.status(500).json({
        error: "Database query failed",
        ...(IS_DEV && { details: error instanceof Error ? error.message : String(error) }),
      });
    }

    let user = existingUser;

    if (!user) {
      // Attribution happens exactly once, right here, inside the same
      // transaction as the insert — there is no later code path that can set
      // `referredById`, so a user can never be attributed or rewarded twice.
      user = await db.transaction(async (tx) => {
        let referrer: typeof usersTable.$inferSelect | undefined;
        if (referralCode) {
          [referrer] = await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.referralCode, referralCode))
            .limit(1);
        }

        const [newUser] = await tx
          .insert(usersTable)
          .values({
            telegramId,
            username,
            firstName: tgUser.first_name || null,
            lastName: tgUser.last_name || null,
            photoUrl: tgUser.photo_url || null,
            referredById: referrer ? referrer.id : null,
            coins: referrer ? 100 + REFERRAL_SIGNUP_BONUS_COINS : 100,
          })
          .returning();

        // Backfill the shareable code now that we know the new row's id.
        const [withCode] = await tx
          .update(usersTable)
          .set({ referralCode: referralCodeFromId(newUser.id) })
          .where(eq(usersTable.id, newUser.id))
          .returning();

        if (referrer) {
          await tx
            .update(usersTable)
            .set({
              coins: sql`${usersTable.coins} + ${REFERRAL_INVITER_BONUS_COINS}`,
              referralBonusCoinsEarned: sql`${usersTable.referralBonusCoinsEarned} + ${REFERRAL_INVITER_BONUS_COINS}`,
            })
            .where(eq(usersTable.id, referrer.id));
        }

        return withCode;
      });
    } else {
      const [updated] = await db
        .update(usersTable)
        .set({
          username,
          firstName: tgUser.first_name || null,
          lastName: tgUser.last_name || null,
          photoUrl: tgUser.photo_url || null,
        })
        .where(eq(usersTable.id, user.id))
        .returning();

      user = updated;
    }

    const token = signJwt({
      userId: user.id,
      telegramId: user.telegramId,
      isAdmin: user.isAdmin,
    });

    return res.json({
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    logger.error({ err: error }, "Unhandled auth error");
    return res.status(500).json({
      error: "Internal Server Error",
      ...(IS_DEV && { details: error instanceof Error ? error.message : String(error) }),
    });
  }
});

export function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    coins: user.coins,
    xp: user.xp,
    level: user.level,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    vipLevel: user.vipLevel,
    vipExpiresAt: user.vipExpiresAt?.toISOString() || null,
    totalHarvests: user.totalHarvests,
    totalCoinsEarned: user.totalCoinsEarned,
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    createdAt: user.createdAt.toISOString(),
    energyRegenAt: user.energyRegenAt?.toISOString() || null,
  };
}

export default router;
