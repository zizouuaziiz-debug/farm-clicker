import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_JWT_SECRET =
  `${process.env.SESSION_SECRET || "farm-clicker-dev-secret-do-not-use-in-prod"}_admin`;

export interface AdminJwtPayload {
  adminId: number;
  email: string;
  role: string;
  type: "admin";
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: typeof adminUsersTable.$inferSelect;
    }
  }
}

export function signAdminJwt(payload: Omit<AdminJwtPayload, "type">): string {
  return jwt.sign({ ...payload, type: "admin" }, ADMIN_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAdminJwt(token: string): AdminJwtPayload | null {
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;
    if (payload.type !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAdminJwt(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired admin token" });
    return;
  }

  const [adminUser] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.id, payload.adminId))
    .limit(1);

  if (!adminUser || !adminUser.isActive) {
    res.status(401).json({ error: "Admin account not found or inactive" });
    return;
  }

  req.adminUser = adminUser;
  next();
}
