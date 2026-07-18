import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsersTable, adminLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signAdminJwt, requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { validateBody } from "../middlewares/validateBody.js";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "password is required"),
});

const setupSchema = z.object({
  setupSecret: z.string().min(1, "setupSecret is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
  name: z.string().min(1, "name is required"),
});

const router = Router();

router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!admin || !admin.isActive) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db
    .update(adminUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  await db.insert(adminLogsTable).values({
    adminId: admin.id,
    action: "login",
    targetType: "admin_session",
    details: `Admin ${admin.email} logged in`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  const token = signAdminJwt({ adminId: admin.id, email: admin.email, role: admin.role });

  res.json({
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions,
    },
  });
});

router.get("/me", requireAdminAuth, (req, res) => {
  const admin = req.adminUser!;
  res.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: admin.permissions,
  });
});

router.post("/setup", validateBody(setupSchema), async (req, res) => {
  // Require a setup secret to prevent unauthorized super-admin creation.
  // Set ADMIN_SETUP_SECRET in environment to enable this endpoint.
  const SETUP_SECRET = process.env.ADMIN_SETUP_SECRET;
  if (!SETUP_SECRET) {
    res.status(403).json({ error: "Admin setup is disabled. Set ADMIN_SETUP_SECRET to enable it." });
    return;
  }

  const { setupSecret, email, password, name } = req.body as {
    setupSecret?: string;
    email?: string;
    password?: string;
    name?: string;
  };

  if (setupSecret !== SETUP_SECRET) {
    res.status(401).json({ error: "Invalid setup secret" });
    return;
  }

  const existing = await db.select().from(adminUsersTable).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Admin already exists. Use login." });
    return;
  }

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [admin] = await db
    .insert(adminUsersTable)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role: "super_admin",
      permissions: ["manage_users", "manage_vip", "manage_withdrawals", "manage_game", "manage_settings", "view_statistics"],
    })
    .returning();

  const token = signAdminJwt({ adminId: admin.id, email: admin.email, role: admin.role });

  res.json({
    message: "Super admin created successfully",
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
});

export default router;
