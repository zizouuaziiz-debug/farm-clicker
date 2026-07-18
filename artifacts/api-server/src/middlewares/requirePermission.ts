import { Request, Response, NextFunction } from "express";

/**
 * Middleware factory that checks whether the authenticated admin has a given
 * permission in their permissions array. Must be used AFTER requireAdminAuth.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.adminUser;
    if (!admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const perms: string[] = (admin.permissions as string[] | null) ?? [];
    if (!perms.includes(permission)) {
      res.status(403).json({
        error: `Forbidden: '${permission}' permission required`,
      });
      return;
    }
    next();
  };
}
