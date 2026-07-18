import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, adTicketsTable, AD_PLACEMENTS, type AdPlacement } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { serializeUser } from "./auth.js";
import { AD_ENERGY_REWARD, AD_BONUS_COINS, AD_COOLDOWN_MS, getLevelForXp } from "../lib/game-config.js";

const router = Router();

// A ticket is valid for 3 minutes — long enough to load and watch a rewarded
// ad, short enough that a leaked/stolen token is useless soon after.
const TICKET_TTL_MS = 3 * 60 * 1000;

const ticketSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
});

const claimSchema = z.object({
  token: z.string().min(1),
});

function cooldownSeconds(lastClaim: Date | null): number | null {
  if (!lastClaim) return null;
  const elapsed = Date.now() - lastClaim.getTime();
  if (elapsed >= AD_COOLDOWN_MS) return null;
  return Math.ceil((AD_COOLDOWN_MS - elapsed) / 1000);
}

// Placement-specific eligibility beyond the shared cooldown check (e.g.
// daily double requires today's daily reward to already be claimed).
function checkEligibility(placement: AdPlacement, user: typeof usersTable.$inferSelect): string | null {
  if (placement === "energy") {
    const cs = cooldownSeconds(user.lastAdEnergyClaimAt);
    if (cs !== null) return `Cooldown active: ${cs}s remaining`;
    if (user.energy >= user.maxEnergy) return "Energy is already full";
  } else if (placement === "bonus") {
    const cs = cooldownSeconds(user.lastAdBonusClaimAt);
    if (cs !== null) return `Cooldown active: ${cs}s remaining`;
  } else if (placement === "daily_double") {
    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = user.lastDailyClaimAt?.toISOString().slice(0, 10);
    if (lastClaim !== today) return "Claim your daily reward first";
    const cs = cooldownSeconds(user.lastAdDailyDoubleAt);
    if (cs !== null) return "Daily double already used today";
  }
  return null;
}

router.get("/status", requireAuth, async (req, res) => {
  const user = req.user!;
  const ecs = cooldownSeconds(user.lastAdEnergyClaimAt);
  const bcs = cooldownSeconds(user.lastAdBonusClaimAt);
  const dcs = cooldownSeconds(user.lastAdDailyDoubleAt);

  res.json({
    energyAd: { available: ecs === null && user.energy < user.maxEnergy, cooldownSeconds: ecs },
    bonusAd: { available: bcs === null, cooldownSeconds: bcs },
    dailyDoubleAd: { available: dcs === null, cooldownSeconds: dcs },
  });
});

// Step 1: eligibility check + issue a single-use ticket, *before* the ad plays.
router.post("/ticket", requireAuth, validateBody(ticketSchema), async (req, res) => {
  const user = req.user!;
  const { placement } = req.body as { placement: AdPlacement };

  const ineligible = checkEligibility(placement, user);
  if (ineligible) {
    res.status(400).json({ error: ineligible });
    return;
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  await db.insert(adTicketsTable).values({
    userId: user.id,
    placement,
    token,
    expiresAt,
  });

  res.json({ token, expiresAt: expiresAt.toISOString() });
});

// Step 2: after the ad SDK reports completion, redeem the ticket exactly
// once and grant the placement's reward inside a single transaction.
router.post("/claim", requireAuth, validateBody(claimSchema), async (req, res) => {
  const user = req.user!;
  const { token } = req.body as { token: string };

  try {
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(adTicketsTable)
        .where(
          and(
            eq(adTicketsTable.token, token),
            eq(adTicketsTable.userId, user.id),
            isNull(adTicketsTable.claimedAt),
          ),
        )
        .limit(1);

      if (!ticket) {
        throw new ClaimError(400, "Invalid or already-claimed ticket");
      }
      if (ticket.expiresAt.getTime() < Date.now()) {
        throw new ClaimError(400, "Ticket expired — request a new one");
      }

      // Re-check eligibility at claim time too: cooldowns/energy may have
      // changed between ticket issuance and claim (e.g. two tabs, energy
      // regenerated to full in the meantime).
      const [freshUser] = await tx.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
      const ineligible = checkEligibility(ticket.placement, freshUser);
      if (ineligible) {
        throw new ClaimError(400, ineligible);
      }

      // Mark claimed first — if anything below fails, the ticket is still
      // burned, which is the safe failure mode (no double-spend risk).
      await tx
        .update(adTicketsTable)
        .set({ claimedAt: new Date() })
        .where(eq(adTicketsTable.id, ticket.id));

      const placement = ticket.placement;

      if (placement === "energy") {
        const newEnergy = Math.min(freshUser.energy + AD_ENERGY_REWARD, freshUser.maxEnergy);
        const [updated] = await tx
          .update(usersTable)
          .set({ energy: newEnergy, lastAdEnergyClaimAt: new Date() })
          .where(eq(usersTable.id, freshUser.id))
          .returning();
        return { reward: { coins: 0, xp: 0, energy: AD_ENERGY_REWARD }, user: serializeUser(updated) };
      }

      if (placement === "bonus") {
        const [updated] = await tx
          .update(usersTable)
          .set({
            coins: freshUser.coins + AD_BONUS_COINS,
            totalCoinsEarned: freshUser.totalCoinsEarned + AD_BONUS_COINS,
            lastAdBonusClaimAt: new Date(),
          })
          .where(eq(usersTable.id, freshUser.id))
          .returning();
        return { reward: { coins: AD_BONUS_COINS, xp: 0 }, user: serializeUser(updated) };
      }

      // daily_double
      const bonusCoins = 100;
      const bonusXp = 50;
      const newXp = freshUser.xp + bonusXp;
      const newLevel = getLevelForXp(newXp);
      const [updated] = await tx
        .update(usersTable)
        .set({
          coins: freshUser.coins + bonusCoins,
          xp: newXp,
          level: newLevel,
          totalCoinsEarned: freshUser.totalCoinsEarned + bonusCoins,
          totalXpEarned: freshUser.totalXpEarned + bonusXp,
          lastAdDailyDoubleAt: new Date(),
        })
        .where(eq(usersTable.id, freshUser.id))
        .returning();
      return { reward: { coins: bonusCoins, xp: bonusXp }, user: serializeUser(updated) };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof ClaimError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
});

class ClaimError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default router;
