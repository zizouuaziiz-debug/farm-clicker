import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const items = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.userId, user.id));

  res.json(
    items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      quantity: i.quantity,
    }))
  );
});

export default router;
