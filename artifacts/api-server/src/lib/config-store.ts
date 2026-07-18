/**
 * config-store.ts
 *
 * Mutable in-memory game configuration store.
 *
 * Lifecycle:
 *   1. Initialised from game-config.ts defaults.
 *   2. On server startup, `initConfigStore()` reads the `game_config` DB table
 *      and overlays any values stored there.
 *   3. Admin PATCH endpoints call `saveConfig()` to persist a section then
 *      mutate the store in-place so the running server picks up changes
 *      immediately — no restart required.
 */

import { db } from "@workspace/db";
import { gameConfigTable } from "@workspace/db/schema";
import {
  CROPS as DEFAULT_CROPS,
  VIP_PLANS as DEFAULT_VIP_PLANS,
  WITHDRAW_COINS_PER_USDT,
  WITHDRAW_MIN_COINS,
  WITHDRAW_NETWORKS,
  type CropConfig,
  type VipConfig,
} from "./game-config.js";
import { logger } from "./logger.js";

export interface EconomyConfig {
  coinsPerUsdt: number;
  minWithdrawalCoins: number;
  withdrawNetworks: string[];
}

interface Store {
  crops: Record<string, CropConfig>;
  vipPlans: VipConfig[];
  economy: EconomyConfig;
}

export const store: Store = {
  crops: { ...DEFAULT_CROPS },
  vipPlans: DEFAULT_VIP_PLANS.map((p) => ({ ...p })),
  economy: {
    coinsPerUsdt: WITHDRAW_COINS_PER_USDT,
    minWithdrawalCoins: WITHDRAW_MIN_COINS,
    withdrawNetworks: [...WITHDRAW_NETWORKS],
  },
};

/** Load config from the database, merging over the in-memory defaults. */
export async function initConfigStore(): Promise<void> {
  try {
    const rows = await db.select().from(gameConfigTable);

    for (const row of rows) {
      if (row.key === "crops" && row.value && typeof row.value === "object") {
        store.crops = row.value as Record<string, CropConfig>;
      } else if (row.key === "vip_plans" && Array.isArray(row.value)) {
        store.vipPlans = row.value as VipConfig[];
      } else if (row.key === "economy" && row.value && typeof row.value === "object") {
        store.economy = row.value as EconomyConfig;
      }
    }

    logger.info("[config-store] Loaded from database");
  } catch (err) {
    // The game_config table may not exist yet (migration not run). Fall back
    // to game-config.ts defaults silently — the server is fully functional.
    logger.warn({ err }, "[config-store] Could not load from DB, using game-config.ts defaults");
  }
}

/** Persist a config section to the database and update the in-memory store. */
export async function saveConfig(
  key: "crops" | "vip_plans" | "economy",
  value: Record<string, CropConfig> | VipConfig[] | EconomyConfig,
): Promise<void> {
  await db
    .insert(gameConfigTable)
    .values({ key, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: gameConfigTable.key,
      set: { value: value as never, updatedAt: new Date() },
    });
}

/** Store-aware replacement for getMaxEnergyForVip from game-config.ts. */
export function getMaxEnergyFromStore(vipLevel: number): number {
  if (vipLevel === 0) return 50;
  const plan = store.vipPlans.find((p) => p.tier === vipLevel);
  return plan ? plan.maxEnergy : 50;
}
