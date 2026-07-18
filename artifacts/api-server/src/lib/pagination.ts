import type { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parses and clamps `page`/`limit` query params into a safe offset-based
 * pagination window. Shared by every list endpoint so the clamping rules
 * (min page 1, max page size) stay consistent across routes.
 */
export function parsePagination(
  req: Request,
  { defaultLimit = 20, maxLimit = 50 }: { defaultLimit?: number; maxLimit?: number } = {},
): PaginationParams {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit || String(defaultLimit)), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
