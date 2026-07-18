import { Request, Response, NextFunction } from "express";
import { verifyJwt, JwtPayload } from "../lib/auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ENERGY_REGEN_INTERVAL_MS } from "../lib/game-config.js";

declare global {
  namespace Express {
    interface Request {
      user?: typeof usersTable.$inferSelect;
      jwtPayload?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  // Passive energy regeneration: 1 energy per ENERGY_REGEN_INTERVAL_MS
  if (user.energy < user.maxEnergy) {
    const lastRegen = user.energyRegenAt ?? user.createdAt;
    const elapsed = Date.now() - lastRegen.getTime();
    const regenAmount = Math.floor(elapsed / ENERGY_REGEN_INTERVAL_MS);

    if (regenAmount > 0) {
      const newEnergy = Math.min(user.maxEnergy, user.energy + regenAmount);
      const newEnergyRegenAt = new Date(
        lastRegen.getTime() + regenAmount * ENERGY_REGEN_INTERVAL_MS
      );

      const [updated] = await db
        .update(usersTable)
        .set({ energy: newEnergy, energyRegenAt: newEnergyRegenAt })
        .where(eq(usersTable.id, user.id))
        .returning();

      user = updated;
    }
  }

  req.user = user;
  req.jwtPayload = payload;
  next();
}
