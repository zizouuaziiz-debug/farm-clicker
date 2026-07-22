import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  broadcastsTable,
  broadcastSentTable,
} from "@workspace/db/schema";
import {
  desc,
  eq,
  count,
} from "drizzle-orm";

import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { validateBody } from "../middlewares/validateBody.js";

const router = Router();

router.use(requireAdminAuth);


const createBroadcastSchema = z.object({
  message: z.string().min(1).max(4096),
  parseMode: z.string().optional(),
  target: z.string().optional(),
});


// CREATE BROADCAST
router.post(
  "/",
  validateBody(createBroadcastSchema),
  async (req, res) => {

    try {

      const {
        message,
        parseMode,
        target,
      } = req.body;


      const [broadcast] = await db
        .insert(broadcastsTable)
        .values({
          message,
          parseMode: parseMode || "HTML",
          target: target || "all",
          status: "pending",
          createdBy: req.adminUser!.id,
        })
        .returning();


      res.json(broadcast);


    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to create broadcast",
      });

    }

  }
);



// GET ALL BROADCASTS
router.get(
  "/",
  async (_req, res) => {

    try {

      const rows = await db
        .select()
        .from(broadcastsTable)
        .orderBy(
          desc(broadcastsTable.createdAt)
        );


      res.json(rows);


    } catch(error){

      console.error(error);

      res.status(500).json({
        error:"Failed to load broadcasts",
      });

    }

  }
);




// BROADCAST STATS
router.get(
  "/:id/stats",
  async(req,res)=>{


    const id = Number(req.params.id);


    if(Number.isNaN(id)){
      return res.status(400).json({
        error:"Invalid broadcast id",
      });
    }



    try {


      const [broadcast] = await db
        .select()
        .from(broadcastsTable)
        .where(
          eq(
            broadcastsTable.id,
            id
          )
        )
        .limit(1);



      if(!broadcast){

        return res.status(404).json({
          error:"Broadcast not found",
        });

      }



      const [sent] = await db
        .select({
          total: count(),
        })
        .from(broadcastSentTable)
        .where(
          eq(
            broadcastSentTable.broadcastId,
            id
          )
        );



      const [success] = await db
        .select({
          total: count(),
        })
        .from(broadcastSentTable)
        .where(
          eq(
            broadcastSentTable.broadcastId,
            id
          )
        )
        .where(
          eq(
            broadcastSentTable.status,
            "sent"
          )
        );



      const [failed] = await db
        .select({
          total: count(),
        })
        .from(broadcastSentTable)
        .where(
          eq(
            broadcastSentTable.broadcastId,
            id
          )
        )
        .where(
          eq(
            broadcastSentTable.status,
            "failed"
          )
        );



      res.json({

        broadcast,

        sent: Number(sent.total),

        success: Number(success.total),

        failed: Number(failed.total),

      });



    } catch(error){

      console.error(error);

      res.status(500).json({
        error:"Failed to load stats",
      });

    }

  }
);



export default router;
