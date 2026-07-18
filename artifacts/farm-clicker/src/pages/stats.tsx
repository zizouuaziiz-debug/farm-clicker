import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@/api-client";
import { GameCard } from "@/components/ui/game-ui";
import { Loader2, BarChart3, Sprout, Droplets, Star, TrendingUp, CalendarDays } from "lucide-react";

const CROP_EMOJI: Record<string, string> = {
  wheat: "🌾",
  sunflower: "🌻",
  tomato: "🍅",
  carrot: "🥕",
  potato: "🥔",
  corn: "🌽",
};

export default function Stats() {
  const { data: stats, isLoading } = useGetPlayerStats({
    query: { queryKey: getGetPlayerStatsQueryKey() }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!stats) return null;

  const totalCrops = Object.values(stats.cropsHarvestedByType).reduce((a, b) => a + b, 0);

  const statItems = [
    { label: "Total Harvests", value: stats.totalHarvests.toLocaleString(), icon: Sprout, color: "text-green-500", bg: "bg-green-100" },
    { label: "Plots Watered", value: stats.totalWatered.toLocaleString(), icon: Droplets, color: "text-blue-500", bg: "bg-blue-100" },
    { label: "Coins Earned", value: stats.totalCoinsEarned.toLocaleString(), icon: TrendingUp, color: "text-yellow-500", bg: "bg-yellow-100" },
    { label: "XP Gained", value: stats.totalXpEarned.toLocaleString(), icon: Star, color: "text-purple-500", bg: "bg-purple-100" },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-pink-100 text-pink-500 rounded-xl flex items-center justify-center border border-pink-200">
          <BarChart3 size={24} />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl leading-none">Your Stats</h1>
          <p className="text-muted-foreground text-sm">Farming history — Lvl {stats.level}</p>
        </div>
      </div>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item, i) => (
          <GameCard key={i} className="p-4">
            <div className={`w-8 h-8 rounded-lg ${item.bg} ${item.color} flex items-center justify-center mb-3`}>
              <item.icon size={18} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="font-display font-bold text-xl">{item.value}</p>
          </GameCard>
        ))}
      </div>

      {/* Streak card */}
      <GameCard className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={20} className="text-orange-500" />
          <h3 className="font-display font-bold text-lg">Login Streaks</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center bg-orange-50 rounded-2xl p-3 border border-orange-100">
            <p className="text-3xl font-display font-bold text-orange-500">{stats.currentStreak}</p>
            <p className="text-xs text-muted-foreground mt-1">Current Streak 🔥</p>
          </div>
          <div className="text-center bg-amber-50 rounded-2xl p-3 border border-amber-100">
            <p className="text-3xl font-display font-bold text-amber-600">{stats.longestStreak}</p>
            <p className="text-xs text-muted-foreground mt-1">Best Streak 🏆</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Farming for {stats.daysSinceJoined} day{stats.daysSinceJoined !== 1 ? "s" : ""}
        </p>
      </GameCard>

      {/* Crops harvested */}
      <GameCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">Crops Harvested</h3>
          <span className="text-sm font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            {totalCrops} total
          </span>
        </div>
        <div className="space-y-3">
          {Object.entries(stats.cropsHarvestedByType)
            .filter(([, count]) => count > 0 || true)
            .map(([type, count]) => {
              const pct = totalCrops > 0 ? Math.round((count / totalCrops) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="capitalize font-medium text-sm flex items-center gap-2">
                      {CROP_EMOJI[type] || "🌱"} {type}
                    </span>
                    <span className="font-display font-bold text-sm text-muted-foreground">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          {totalCrops === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-2">No crops harvested yet.</p>
          )}
        </div>
      </GameCard>
    </div>
  );
}
