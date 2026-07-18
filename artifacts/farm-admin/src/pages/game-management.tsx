import { useEffect, useRef, useState } from "react";
import { fetchAdmin } from "@/lib/admin-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CropConfig {
  cropType: string;
  name: string;
  emoji: string;
  buyCost: number;
  sellPrice: number;
  growTimeMinutes: number;
  waterNeeded: number;
  requiredLevel: number;
  xpReward: number;
  coinsPerHarvest: number;
}

interface VipPlan {
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

interface GameConfig {
  crops: CropConfig[];
  vipPlans: VipPlan[];
  withdrawNetworks: string[];
  coinsPerUsdt: number;
  minWithdrawalCoins: number;
  minWithdrawalUsdt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VIP_COLORS: Record<number, string> = {
  1: "border-orange-200 bg-orange-50",
  2: "border-gray-200 bg-gray-50",
  3: "border-yellow-200 bg-yellow-50",
  4: "border-blue-200 bg-blue-50",
  5: "border-purple-200 bg-purple-50",
};

function NumInput({
  value,
  onChange,
  min = 0,
  step = 1,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) =>
        onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))
      }
      className={`w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 bg-white ${className}`}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GameManagement() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [draft, setDraft] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"crops" | "vip" | "economy">("crops");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchAdmin<GameConfig>("/api/admin/game-config")
      .then(setConfig)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Edit mode controls ──────────────────────────────────────────────────────

  const handleEdit = () => {
  console.log("=== CROPS ===");

  config?.crops.forEach((crop) => {
    console.log(
      crop.name,
      "xpReward =",
      crop.xpReward,
      "type =",
      typeof crop.xpReward
    );
  });

  setDraft(JSON.parse(JSON.stringify(config)));
  setEditing(true);
};

  const handleCancel = () => {
    setDraft(null);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await fetchAdmin<GameConfig>("/api/admin/game-config", {
        method: "PATCH",
        body: JSON.stringify({
          crops: draft.crops,
          vipPlans: draft.vipPlans,
          economy: {
            coinsPerUsdt: draft.coinsPerUsdt,
            minWithdrawalCoins: draft.minWithdrawalCoins,
            withdrawNetworks: draft.withdrawNetworks,
          },
        }),
      });
      setConfig(saved);
      setDraft(null);
      setEditing(false);
      showToast("success", "Configuration saved successfully");
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  // ── Draft mutation helpers ──────────────────────────────────────────────────

  const updateCrop = (cropType: string, field: keyof CropConfig, raw: string) => {
    if (!draft) return;
    const value = field === "growTimeMinutes" || Number.isFinite(parseFloat(raw))
      ? parseFloat(raw)
      : parseInt(raw, 10);
    setDraft({
      ...draft,
      crops: draft.crops.map((c) => c.cropType === cropType ? { ...c, [field]: value } : c),
    });
  };

  const updateVip = (tier: number, field: keyof VipPlan, value: unknown) => {
    if (!draft) return;
    setDraft({
      ...draft,
      vipPlans: draft.vipPlans.map((p) => p.tier === tier ? { ...p, [field]: value } : p),
    });
  };

  const updateEconomy = (field: "coinsPerUsdt" | "minWithdrawalCoins", value: number) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  };

  const updateNetworks = (raw: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      withdrawNetworks: raw.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const display = editing ? draft! : config!;

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Game Economy</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Game Economy</h1>
        <div className="text-red-600 bg-red-50 rounded-xl p-4">{error || "Failed to load config"}</div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Game Economy</h1>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                ) : null}
                {saving ? "Saving…" : "💾 Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        {editing
          ? "Edit mode — changes are saved to the database and take effect immediately."
          : "Live game configuration loaded from the database."}
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["crops", "vip", "economy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-xl capitalize transition-colors ${
              tab === t ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t === "crops" ? "🌱 Crops" : t === "vip" ? "💎 VIP Plans" : "💰 Economy"}
          </button>
        ))}
      </div>

      {/* ── Crops tab ─────────────────────────────────────────────────────────── */}
      {tab === "crops" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Crop</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Buy 🪙</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sell 🪙</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Grow (min)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Water 💧</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Req. Lvl ⭐</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">XP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Coins/Harvest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {display.crops.map((crop) => (
                <tr key={crop.cropType} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{crop.emoji}</span>
                      <span className="font-medium text-gray-900">{crop.name}</span>
                    </div>
                  </td>
                  {editing ? (
                    <>
                      <td className="px-4 py-2">
                        <NumInput value={crop.buyCost} min={0}
                          onChange={(v) => updateCrop(crop.cropType, "buyCost", String(v))} className="w-20" />
                      </td>
                      <td className="px-4 py-2">
                        <NumInput value={crop.sellPrice} min={0}
                          onChange={(v) => updateCrop(crop.cropType, "sellPrice", String(v))} className="w-20" />
                      </td>
                      <td className="px-4 py-2">
                        <NumInput value={crop.growTimeMinutes} min={1}
                          onChange={(v) => updateCrop(crop.cropType, "growTimeMinutes", String(v))} className="w-20" />
                      </td>
                      <td className="px-4 py-2">
                        <NumInput value={crop.waterNeeded} min={0}
                          onChange={(v) => updateCrop(crop.cropType, "waterNeeded", String(v))} className="w-16" />
                      </td>
                      <td className="px-4 py-2">
                        <NumInput value={crop.requiredLevel} min={1}
                          onChange={(v) => updateCrop(crop.cropType, "requiredLevel", String(v))} className="w-16" />
                      </td>
                      <td className="px-4 py-2">
  {console.log("XP DEBUG:", crop.name, crop.xpReward, typeof crop.xpReward)}

  <NumInput
    value={crop.xpReward}
    min={0}
    onChange={(v) => updateCrop(crop.cropType, "xpReward", String(v))}
    className="w-20"
  />
</td>
                      <td className="px-4 py-2">
  {console.log("XP DEBUG:", crop.name, crop.xpReward, typeof crop.xpReward)}

  <NumInput
    value={crop.xpReward}
    min={0}
    onChange={(v) => updateCrop(crop.cropType, "xpReward", String(v))}
    className="w-20"
  />
</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${crop.sellPrice - crop.buyCost > 0 ? "text-green-600" : "text-red-600"}`}>
                          {crop.sellPrice - crop.buyCost > 0 ? "+" : ""}{crop.sellPrice - crop.buyCost}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-700">{crop.buyCost}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{crop.sellPrice}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {crop.growTimeMinutes >= 60
                          ? `${(crop.growTimeMinutes / 60).toFixed(1)}h`
                          : `${crop.growTimeMinutes}m`}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{crop.waterNeeded}</td>
                      <td className="px-4 py-3 text-gray-700">{crop.requiredLevel}</td>
                      <td className="px-4 py-3 text-purple-700">+{crop.xpReward}</td>
                      <td className="px-4 py-3 text-gray-700">{crop.coinsPerHarvest.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${crop.sellPrice - crop.buyCost > 0 ? "text-green-600" : "text-red-600"}`}>
                          {crop.sellPrice - crop.buyCost > 0 ? "+" : ""}{crop.sellPrice - crop.buyCost}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIP Plans tab ─────────────────────────────────────────────────────── */}
      {tab === "vip" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {display.vipPlans.map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-2xl border p-5 ${VIP_COLORS[plan.tier] ?? "border-gray-100 bg-gray-50"}`}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">{plan.emoji}</span>
                <div>
                  <div className="font-bold text-gray-900">{plan.name}</div>
                  <div className="text-xs text-gray-500">Tier {plan.tier}</div>
                </div>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">Price (USDT)</span>
                      <NumInput value={plan.priceUsdt} min={0} step={0.01}
                        onChange={(v) => updateVip(plan.tier, "priceUsdt", v)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">Duration (days)</span>
                      <NumInput value={plan.durationDays} min={1}
                        onChange={(v) => updateVip(plan.tier, "durationDays", v)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">Max Energy ⚡</span>
                      <NumInput value={plan.maxEnergy} min={1}
                        onChange={(v) => updateVip(plan.tier, "maxEnergy", v)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">XP Multiplier</span>
                      <NumInput value={plan.xpMultiplier} min={1} step={0.1}
                        onChange={(v) => updateVip(plan.tier, "xpMultiplier", v)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">Grow Speed</span>
                      <NumInput value={plan.growSpeedMultiplier} min={1} step={0.1}
                        onChange={(v) => updateVip(plan.tier, "growSpeedMultiplier", v)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500 block mb-1">Farm Slots</span>
                      <NumInput value={plan.maxSlots} min={1}
                        onChange={(v) => updateVip(plan.tier, "maxSlots", v)} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-gray-500 block mb-1">Benefits (one per line)</span>
                    <textarea
                      rows={4}
                      value={plan.benefits.join("\n")}
                      onChange={(e) =>
                        updateVip(plan.tier, "benefits", e.target.value.split("\n"))
                      }
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white resize-none"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-green-700 text-lg">${plan.priceUsdt} USDT</span>
                    <span className="text-xs text-gray-500">{plan.durationDays} days</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-500">Max Energy</div>
                      <div className="font-semibold text-gray-900">{plan.maxEnergy} ⚡</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-500">XP Bonus</div>
                      <div className="font-semibold text-gray-900">{plan.xpMultiplier}x</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-500">Farm Slots</div>
                      <div className="font-semibold text-gray-900">{plan.maxSlots}</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-500">Grow Speed</div>
                      <div className="font-semibold text-gray-900">{plan.growSpeedMultiplier}x</div>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {plan.benefits.filter(Boolean).map((b, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <span className="text-green-500">✓</span> {b}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Economy tab ───────────────────────────────────────────────────────── */}
      {tab === "economy" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">💸 Withdrawal Settings</h2>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-sm text-gray-500 block mb-1">Coins per USDT</span>
                  <NumInput value={display.coinsPerUsdt} min={1}
                    onChange={(v) => updateEconomy("coinsPerUsdt", v)}
                    className="w-full" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-500 block mb-1">Min Withdrawal (coins)</span>
                  <NumInput value={display.minWithdrawalCoins} min={0}
                    onChange={(v) => updateEconomy("minWithdrawalCoins", v)}
                    className="w-full" />
                  <span className="text-xs text-gray-400 mt-1 block">
                    = {display.coinsPerUsdt > 0
                      ? (display.minWithdrawalCoins / display.coinsPerUsdt).toFixed(2)
                      : "0"} USDT
                  </span>
                </label>
                <label className="block">
                  <span className="text-sm text-gray-500 block mb-1">Supported Networks (comma-separated)</span>
                  <input
                    type="text"
                    value={display.withdrawNetworks.join(", ")}
                    onChange={(e) => updateNetworks(e.target.value)}
                    placeholder="TRC20, ERC20, BEP20"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Coins per USDT</div>
                  <div className="text-2xl font-bold text-gray-900">{display.coinsPerUsdt.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Min Withdrawal</div>
                  <div className="text-2xl font-bold text-gray-900">{display.minWithdrawalCoins.toLocaleString()} coins</div>
                  <div className="text-xs text-gray-400 mt-1">{display.minWithdrawalUsdt} USDT</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Supported Networks</div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {display.withdrawNetworks.map((n) => (
                      <span key={n} className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-2">📊 Economy Formula</h2>
            <p className="text-sm text-gray-600">
              Players earn coins through farming and can withdraw them as USDT at a rate of{" "}
              <strong>{display.coinsPerUsdt.toLocaleString()} coins = 1 USDT</strong>. Minimum
              withdrawal is {display.minWithdrawalCoins.toLocaleString()} coins (
              {display.coinsPerUsdt > 0
                ? (display.minWithdrawalCoins / display.coinsPerUsdt).toFixed(2)
                : "0"}{" "}
              USDT).
            </p>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 transition-all ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
