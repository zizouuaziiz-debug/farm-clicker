export interface CropConfig {
  cropType: string;
  name: string;
  emoji: string;
  buyCost: number;
  sellPrice: number;
  growTimeMs: number;
  waterNeeded: number;
  requiredLevel: number;
  xpReward: number;
  coinsPerHarvest: number;
  quantity: number;
  witherGraceMs: number;
}
{
  "wheat": {
    "name": "Wheat",
    "emoji": "🌾",
    "buyCost": 10,
    "cropType": "wheat",
    "quantity": 3,
    "xpReward": 5,
    "sellPrice": 6,
    "growTimeMs": 300000,
    "waterNeeded": 1,
    "requiredLevel": 1,
    "witherGraceMs": 1800000,
    "coinsPerHarvest": 8
  },
  "sunflower": {
    "name": "Sunflower",
    "emoji": "🌻",
    "buyCost": 20,
    "cropType": "sunflower",
    "quantity": 2,
    "xpReward": 10,
    "sellPrice": 18,
    "growTimeMs": 480000,
    "waterNeeded": 1,
    "requiredLevel": 2,
    "witherGraceMs": 2700000,
    "coinsPerHarvest": 15
  },
  "tomato": {
    "name": "Tomato",
    "emoji": "🍅",
    "buyCost": 35,
    "cropType": "tomato",
    "quantity": 2,
    "xpReward": 15,
    "sellPrice": 30,
    "growTimeMs": 900000,
    "waterNeeded": 2,
    "requiredLevel": 3,
    "witherGraceMs": 3600000,
    "coinsPerHarvest": 25
  },
  "carrot": {
    "name": "Carrot",
    "emoji": "🥕",
    "buyCost": 50,
    "cropType": "carrot",
    "quantity": 3,
    "xpReward": 25,
    "sellPrice": 45,
    "growTimeMs": 1320000,
    "waterNeeded": 2,
    "requiredLevel": 4,
    "witherGraceMs": 5400000,
    "coinsPerHarvest": 35
  },
  "potato": {
    "name": "Potato",
    "emoji": "🥔",
    "buyCost": 70,
    "cropType": "potato",
    "quantity": 4,
    "xpReward": 35,
    "sellPrice": 65,
    "growTimeMs": 1800000,
    "waterNeeded": 3,
    "requiredLevel": 5,
    "witherGraceMs": 7200000,
    "coinsPerHarvest": 50
  },
  "corn": {
    "name": "Corn",
    "emoji": "🌽",
    "buyCost": 100,
    "cropType": "corn",
    "quantity": 4,
    "xpReward": 50,
    "sellPrice": 100,
    "growTimeMs": 2700000,
    "waterNeeded": 3,
    "requiredLevel": 6,
    "witherGraceMs": 10800000,
    "coinsPerHarvest": 80
  }
}

export type CropHarvestField =
  | "cropsHarvestedWheat"
  | "cropsHarvestedSunflower"
  | "cropsHarvestedTomato"
  | "cropsHarvestedCarrot"
  | "cropsHarvestedPotato"
  | "cropsHarvestedCorn";

export const CROP_HARVEST_FIELDS: Record<string, CropHarvestField> = {
  wheat: "cropsHarvestedWheat",
  sunflower: "cropsHarvestedSunflower",
  tomato: "cropsHarvestedTomato",
  carrot: "cropsHarvestedCarrot",
  potato: "cropsHarvestedPotato",
  corn: "cropsHarvestedCorn",
};

export interface VipConfig {
  tier: number;
  name: string;
  emoji: string;
  priceUsdt: number;
  durationDays: number;
  maxEnergy: number;
  xpMultiplier: number;
  growSpeedMultiplier: number;
  benefits: string[];
  maxSlots: number;
}

export const VIP_PLANS: VipConfig[] = [
  {
    tier: 1,
    name: "Bronze",
    emoji: "🥉",
    priceUsdt: 3,
    durationDays: 30,
    maxEnergy: 75,
    xpMultiplier: 1.2,
    growSpeedMultiplier: 1.1,
    benefits: ["75 max energy", "1.2x XP", "4 farm slots", "10% faster crops", "Bronze VIP badge"],
    maxSlots: 4,
  },
  {
    tier: 2,
    name: "Silver",
    emoji: "🥈",
    priceUsdt: 10,
    durationDays: 30,
    maxEnergy: 100,
    xpMultiplier: 1.5,
    growSpeedMultiplier: 1.2,
    benefits: ["100 max energy", "1.5x XP", "5 farm slots", "20% faster crops", "Harvest-all button", "Silver VIP badge"],
    maxSlots: 5,
  },
  {
    tier: 3,
    name: "Gold",
    emoji: "🥇",
    priceUsdt: 25,
    durationDays: 30,
    maxEnergy: 200,
    xpMultiplier: 2.0,
    growSpeedMultiplier: 1.5,
    benefits: ["200 max energy", "2x XP", "8 farm slots", "50% faster crops", "Water-all button", "Ad-free energy", "Gold VIP badge"],
    maxSlots: 8,
  },
  {
    tier: 4,
    name: "Diamond",
    emoji: "💎",
    priceUsdt: 50,
    durationDays: 30,
    maxEnergy: 500,
    xpMultiplier: 3.0,
    growSpeedMultiplier: 2.0,
    benefits: ["500 max energy", "3x XP", "12 farm slots", "2x grow speed", "All Gold perks", "Priority support", "Diamond VIP badge"],
    maxSlots: 12,
  },
  {
    tier: 5,
    name: "Platinum",
    emoji: "💫",
    priceUsdt: 100,
    durationDays: 30,
    maxEnergy: 1000,
    xpMultiplier: 5.0,
    growSpeedMultiplier: 3.0,
    benefits: ["1000 max energy", "5x XP", "16 farm slots", "3x grow speed", "All Diamond perks", "Exclusive Platinum badge", "Dedicated support"],
    maxSlots: 16,
  },
];

export const VIP_TIER_NAMES: Record<number, string> = {
  0: "None",
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Diamond",
  5: "Platinum",
};

export const VIP_TIER_EMOJIS: Record<number, string> = {
  0: "",
  1: "🥉",
  2: "🥈",
  3: "🥇",
  4: "💎",
  5: "💫",
};

export const BASE_SLOTS = 9;

export function getSlotsForVip(vipLevel: number): number {
  if (vipLevel === 0) return BASE_SLOTS;
  const plan = VIP_PLANS.find((p) => p.tier === vipLevel);
  return plan ? plan.maxSlots : BASE_SLOTS;
}

export function getMaxEnergyForVip(vipLevel: number): number {
  if (vipLevel === 0) return 50;
  const plan = VIP_PLANS.find((p) => p.tier === vipLevel);
  return plan ? plan.maxEnergy : 50;
}

export const LEVEL_THRESHOLDS: number[] = [0, 100, 250, 500, 1000, 2000, 4000, 7000, 11000, 16000, 22000];

export function getLevelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export const ENERGY_REFILL_COST = 50;
export const ENERGY_PER_PLANT = 1;
export const ENERGY_REGEN_INTERVAL_MS = 3 * 60 * 1000;

export const VIP_WALLET = process.env.VIP_WALLET_ADDRESS || "TBD_SET_VIP_WALLET_ADDRESS";
export const VIP_NETWORK = "BEP20 (BSC)";
export const WITHDRAW_NETWORKS = ["TRC20", "ERC20", "BEP20"] as const;
export type WithdrawNetwork = typeof WITHDRAW_NETWORKS[number];

export const WITHDRAW_COINS_PER_USDT = 1000;
export const WITHDRAW_MIN_COINS = 5000;

export const DAILY_REWARDS = [
  { coins: 50, xp: 10 },
  { coins: 75, xp: 15 },
  { coins: 100, xp: 20 },
  { coins: 150, xp: 30 },
  { coins: 200, xp: 40 },
  { coins: 300, xp: 60 },
  { coins: 500, xp: 100, bonus: "🎁 Bonus Day!" },
];

export const AD_ENERGY_REWARD = 20;
export const AD_BONUS_COINS = 100;
export const AD_COOLDOWN_MS = 30 * 60 * 1000;

// Referral system: coins granted immediately (once) when a referral is attributed at signup.
export const REFERRAL_SIGNUP_BONUS_COINS = 100;
export const REFERRAL_INVITER_BONUS_COINS = 200;
