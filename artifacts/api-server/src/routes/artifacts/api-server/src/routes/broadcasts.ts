import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { broadcastsTable, broadcastSentTable } from "@workspace/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { validateBody } from "../middlewares/validateBody.js";

const router = Router();

router.use(requireAdminAuth);


const createBroadcastSchema = z.object({
  message: z.string().min(1).max(4096),
  parseMode: z.string().optional(),
  target: z.string().optional(),
});


// إنشاء رسالة جديدة
router.post("/", validateBody(createBroadcastSchema), async (req,res)=>{

  const {
    message,
    parseMode,
    target
  } = req.body;


  const [broadcast] = await db
    .insert(broadcastsTable)
    .values({
      message,
      parseMode: parseMode || "HTML",
      target: target || "all",
      status:"pending",
      createdBy:req.adminUser!.id,
    })
    .returning();


  res.json(broadcast);

});


// قائمة الرسائل
router.get("/", async (_req,res)=>{

  const rows = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt));


  res.json(rows);

});


// تفاصيل الإرسال
router.get("/:id/stats", async(req,res)=>{

  const id = Number(req.params.id);


  const [broadcast] = await db
    .select()
    .from(broadcastsTable)
    .where(eq(broadcastsTable.id,id))
    .limit(1);


  if(!broadcast){
    return res.status(404).json({
      error:"Broadcast not found"
    });
  }


  const [sent] = await db
    .select({
      total:count()
    })
    .from(broadcastSentTable)
    .where(eq(broadcastSentTable.broadcastId,id));


  res.json({
    broadcast,
    sent:Number(sent.total)
  });

});


export default router;
