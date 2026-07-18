-- ============================================================================
-- Farm Clicker — Production Database Schema
-- ============================================================================
-- PostgreSQL 14+
--
-- This file recreates the entire production database from scratch: tables,
-- constraints, foreign keys, indexes, and defaults. It is a byte-for-byte
-- reflection of the live schema managed by Drizzle ORM (lib/db/src/schema/).
--
-- Source of truth for day-to-day schema changes is still Drizzle:
--   pnpm --filter @workspace/db run push
-- This file is the reviewable, portable artifact for provisioning a fresh
-- database (disaster recovery, staging clones, external backups, audits).
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).
-- Running this against an already-provisioned database will not drop or
-- truncate any existing table or data.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table: users
-- Player accounts, authenticated via Telegram initData. Holds game currency,
-- progression, per-crop harvest counters, and daily-streak/ad-cooldown state.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                          SERIAL PRIMARY KEY,
  telegram_id                 TEXT NOT NULL,
  username                    TEXT NOT NULL,
  first_name                  TEXT,
  last_name                   TEXT,
  photo_url                   TEXT,
  coins                        INTEGER NOT NULL DEFAULT 200,
  xp                           INTEGER NOT NULL DEFAULT 0,
  level                        INTEGER NOT NULL DEFAULT 1,
  energy                       INTEGER NOT NULL DEFAULT 50,
  max_energy                   INTEGER NOT NULL DEFAULT 50,
  energy_regen_at              TIMESTAMPTZ,
  vip_level                    INTEGER NOT NULL DEFAULT 0,
  vip_expires_at               TIMESTAMPTZ,
  total_harvests               INTEGER NOT NULL DEFAULT 0,
  total_coins_earned           INTEGER NOT NULL DEFAULT 0,
  total_xp_earned              INTEGER NOT NULL DEFAULT 0,
  total_watered                INTEGER NOT NULL DEFAULT 0,
  longest_streak               INTEGER NOT NULL DEFAULT 0,
  current_streak               INTEGER NOT NULL DEFAULT 0,
  last_daily_claim_at          TIMESTAMPTZ,
  daily_claim_day              INTEGER NOT NULL DEFAULT 0,
  last_ad_energy_claim_at      TIMESTAMPTZ,
  last_ad_bonus_claim_at       TIMESTAMPTZ,
  last_ad_daily_double_at      TIMESTAMPTZ,
  crops_harvested_wheat        INTEGER NOT NULL DEFAULT 0,
  crops_harvested_tomato       INTEGER NOT NULL DEFAULT 0,
  crops_harvested_potato       INTEGER NOT NULL DEFAULT 0,
  crops_harvested_sunflower    INTEGER NOT NULL DEFAULT 0,
  crops_harvested_carrot       INTEGER NOT NULL DEFAULT 0,
  crops_harvested_corn         INTEGER NOT NULL DEFAULT 0,
  is_admin                     BOOLEAN NOT NULL DEFAULT false,
  is_banned                    BOOLEAN NOT NULL DEFAULT false,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id)
);

CREATE INDEX IF NOT EXISTS users_coins_idx ON users (coins);
CREATE INDEX IF NOT EXISTS users_level_idx ON users (level);
CREATE INDEX IF NOT EXISTS users_is_banned_idx ON users (is_banned);

-- ----------------------------------------------------------------------------
-- Table: plots
-- Each user has one farming slot per plot (0..N-1, N depends on VIP level).
-- One row per (user_id, slot) — enforced below.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plots (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  slot          INTEGER NOT NULL,
  state         TEXT NOT NULL DEFAULT 'empty',
  crop_type     TEXT,
  planted_at    TIMESTAMPTZ,
  ready_at      TIMESTAMPTZ,
  watered_at    TIMESTAMPTZ,
  water_stage   INTEGER NOT NULL DEFAULT 0,
  withered_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plots_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT plots_user_slot_unique UNIQUE (user_id, slot)
);

CREATE INDEX IF NOT EXISTS plots_user_id_idx ON plots (user_id);

-- ----------------------------------------------------------------------------
-- Table: inventory
-- Per-user stock of seeds and harvested crops. One row per (user_id,
-- item_type) — enforced below; quantities are incremented/decremented in
-- place by the shop/farm routes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  item_type   TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT inventory_user_item_unique UNIQUE (user_id, item_type)
);

CREATE INDEX IF NOT EXISTS inventory_user_id_idx ON inventory (user_id);

-- ----------------------------------------------------------------------------
-- Table: user_missions
-- Daily mission instances generated per user per calendar day (mission_date
-- is a 'YYYY-MM-DD' string, not a DATE, to match the app's date-key logic).
-- One row per (user_id, mission_date, mission_type) — enforced below.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_missions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  mission_type   TEXT NOT NULL,
  goal            INTEGER NOT NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  claimed         BOOLEAN NOT NULL DEFAULT false,
  mission_date    TEXT NOT NULL,
  reward_coins    INTEGER NOT NULL DEFAULT 0,
  reward_xp       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_missions_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_missions_user_date_type_unique UNIQUE (user_id, mission_date, mission_type)
);

-- ----------------------------------------------------------------------------
-- Table: user_achievements
-- Permanent unlock record. One row per (user_id, achievement_id) — enforced
-- below; achievement catalog itself lives in application code, not the DB.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  achievement_id   TEXT NOT NULL,
  unlocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON user_achievements (user_id);

-- ----------------------------------------------------------------------------
-- Table: withdrawals
-- Player-initiated coin -> USDT payout requests, reviewed by admins.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawals (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  coins_amount    INTEGER NOT NULL,
  usdt_amount     NUMERIC(10, 2) NOT NULL,
  usdt_wallet     TEXT NOT NULL,
  network         TEXT NOT NULL DEFAULT 'TRC20',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | rejected
  tx_hash         TEXT,
  reject_reason   TEXT,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT withdrawals_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals (status);
CREATE INDEX IF NOT EXISTS withdrawals_created_at_idx ON withdrawals (created_at);

-- ----------------------------------------------------------------------------
-- Table: vip_purchases
-- Player-submitted VIP subscription proofs-of-payment, reviewed by admins.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vip_purchases (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  tier            INTEGER NOT NULL,
  tier_name       TEXT,
  price_usdt      NUMERIC(10, 2) NOT NULL,
  duration_days   INTEGER NOT NULL,
  tx_hash         TEXT NOT NULL,
  wallet_sent     TEXT NOT NULL,
  screenshot_url  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason   TEXT,
  admin_notes     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vip_purchases_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS vip_purchases_user_id_idx ON vip_purchases (user_id);
CREATE INDEX IF NOT EXISTS vip_purchases_status_idx ON vip_purchases (status);
CREATE INDEX IF NOT EXISTS vip_purchases_created_at_idx ON vip_purchases (created_at);

-- ----------------------------------------------------------------------------
-- Table: admin_users
-- Staff accounts for the separate admin web panel (email/password, JWT
-- signed with a distinct secret from player sessions).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'admin',
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_email_unique UNIQUE (email)
);

-- ----------------------------------------------------------------------------
-- Table: admin_logs
-- Audit trail of admin actions (approvals/rejections/bans/edits). admin_id
-- is nullable and set to NULL if the admin account is later deleted, so the
-- log entry itself is never lost.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
  id            SERIAL PRIMARY KEY,
  admin_id      INTEGER,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  details       TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_logs_admin_id_admin_users_id_fk FOREIGN KEY (admin_id)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_logs_admin_id_idx ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs (created_at);
CREATE INDEX IF NOT EXISTS admin_logs_action_idx ON admin_logs (action);

-- ----------------------------------------------------------------------------
-- Trigger: keep updated_at current on every UPDATE.
--
-- Not required by the application — every write path already sets
-- updated_at itself via Drizzle's $onUpdate() — but included here so a
-- database restored from this file alone stays correct even against writes
-- issued by tools other than the app (manual SQL, other clients).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users', 'plots', 'inventory', 'user_missions',
    'withdrawals', 'vip_purchases', 'admin_users'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = t || '_set_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
        t || '_set_updated_at', t
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- ============================================================================
-- End of schema. To seed a first admin account, use the app's own flow:
--   POST /api/admin-auth/setup  (guarded by ADMIN_SETUP_SECRET)
-- Do not insert admin_users rows by hand — password_hash must be a bcrypt
-- hash produced by the same library/cost factor the app verifies against.
-- ============================================================================
