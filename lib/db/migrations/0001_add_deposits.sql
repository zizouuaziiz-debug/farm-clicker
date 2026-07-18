-- Migration: Add deposits table for BEP20 USDT auto-verification
-- Run with: pnpm --filter @workspace/db run push  (or drizzle-kit push)

CREATE TABLE IF NOT EXISTS "deposits" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tx_hash" text NOT NULL,
  "amount_usdt" numeric(10, 2) NOT NULL,
  "coins_credit" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "fail_reason" text,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "deposits_tx_hash_unique" UNIQUE("tx_hash")
);

CREATE INDEX IF NOT EXISTS "deposits_user_id_idx" ON "deposits" ("user_id");
CREATE INDEX IF NOT EXISTS "deposits_status_idx" ON "deposits" ("status");
CREATE INDEX IF NOT EXISTS "deposits_created_at_idx" ON "deposits" ("created_at");
