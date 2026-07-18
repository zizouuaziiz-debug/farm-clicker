import { useGetDailyReward, useClaimDailyReward, getGetDailyRewardQueryKey, getGetMeQueryKey, useGetAdsStatus, getGetAdsStatusQueryKey } from "@/api-client";
import { GameCard, GameButton, CoinDisplay } from "@/components/ui/game-ui";
import { Loader2, Check, Calendar as CalendarIcon, PlayCircle, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRewardedAd } from "@/hooks/use-rewarded-ad";

const DAILY_REWARD_AMOUNTS = [
  { coins: 50, xp: 10 },
  { coins: 75, xp: 15 },
  { coins: 100, xp: 20 },
  { coins: 150, xp: 30 },
  { coins: 200, xp: 40 },
  { coins: 300, xp: 60 },
  { coins: 500, xp: 100, bonus: true },
];

export default function Daily() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetDailyReward({
    query: { queryKey: getGetDailyRewardQueryKey() }
  });
  const { data: adsStatus } = useGetAdsStatus({ query: { queryKey: getGetAdsStatusQueryKey() } });
  const claimReward = useClaimDailyReward();
  const dailyDoubleAd = useRewardedAd("daily_double");

  const handleClaim = () => {
    claimReward.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`🎉 Day ${data.day} claimed! +${data.reward.coins}🪙 +${data.reward.xp}⭐`);
        queryClient.invalidateQueries({ queryKey: getGetDailyRewardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdsStatusQueryKey() });
        queryClient.setQueryData(getGetMeQueryKey(), data.user);
      },
      onError: () => toast.error("Already claimed or failed.")
    });
  };

  const handleWatchAdToDouble = async () => {
    try {
      const data = await dailyDoubleAd.watch();
      toast.success(`Doubled! +${data.reward.coins}🪙 +${data.reward.xp}⭐ 🎉`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't double the reward. Try again soon.");
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!status) return null;

  const days = Array.from({ length: 7 }).map((_, i) => {
    const dayNum = i + 1;
    let state = "future";
    if (dayNum < status.day) state = "claimed";
    if (dayNum === status.day) state = status.claimed ? "claimed" : "today";
    return { dayNum, state };
  });

  return (
    <div className="p-4 space-y-6">
      <div className="text-center mb-2">
        <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-amber-200">
          <CalendarIcon size={32} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground">Daily Login</h1>
        <p className="text-muted-foreground text-sm">Come back every day for bigger rewards!</p>
      </div>

      <GameCard className="bg-primary/5 border-primary/20">
        <div className="flex justify-between items-center mb-4">
          <span className="font-display font-bold">Streak: {status.streak} 🔥</span>
          <span className="text-sm font-medium text-muted-foreground">Day {status.day}/7</span>
        </div>

        {/* Day grid: 4 + 3 */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          {days.slice(0, 4).map(d => <DayCard key={d.dayNum} {...d} />)}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {days.slice(4, 7).map(d => <DayCard key={d.dayNum} {...d} />)}
        </div>

        {/* Today's reward preview */}
        {!status.claimed && (
          <div className="flex items-center justify-center gap-4 mb-4 p-3 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-sm font-bold text-amber-700">Today's reward:</span>
            <CoinDisplay amount={status.reward.coins} className="text-sm" />
            <div className="flex items-center gap-1 font-display font-bold text-purple-600 bg-purple-100/50 px-2.5 py-1 rounded-full border border-purple-200 text-sm">
              <Star size={14} className="text-purple-500" /> +{status.reward.xp} XP
            </div>
          </div>
        )}

        <GameButton
          className="w-full h-14 text-lg"
          disabled={status.claimed || claimReward.isPending}
          onClick={handleClaim}
        >
          {status.claimed ? "✓ Come back tomorrow" : "Claim Today's Reward 🎁"}
        </GameButton>

        {status.claimed && adsStatus?.dailyDoubleAd.available && (
          <button
            onClick={handleWatchAdToDouble}
            disabled={dailyDoubleAd.isBusy}
            className="w-full mt-3 h-12 rounded-xl bg-amber-500 text-white font-display font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            <PlayCircle size={18} /> Watch Ad to Double Reward
          </button>
        )}
      </GameCard>
    </div>
  );
}

function DayCard({ dayNum, state }: { dayNum: number; state: string }) {
  const isClaimed = state === "claimed";
  const isToday = state === "today";
  const reward = DAILY_REWARD_AMOUNTS[dayNum - 1];

  return (
    <div className={`
      relative rounded-xl border-2 p-2 flex flex-col items-center justify-center gap-0.5
      min-h-[90px]
      ${isClaimed ? "bg-muted border-border" : ""}
      ${isToday ? "bg-amber-100 border-amber-400 shadow-md ring-2 ring-amber-400 ring-offset-1" : ""}
      ${state === "future" ? "bg-card border-border" : ""}
    `}>
      <span className="text-[10px] font-bold text-muted-foreground">Day {dayNum}</span>
      <span className="text-2xl">{dayNum === 7 ? "🎁" : "🪙"}</span>
      <span className="text-[10px] font-bold text-yellow-600">+{reward.coins}</span>
      <span className="text-[9px] text-muted-foreground">+{reward.xp}xp</span>

      {isClaimed && (
        <div className="absolute inset-0 bg-black/10 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-green-500 rounded-full p-1 text-white shadow-sm">
            <Check size={14} strokeWidth={3} />
          </div>
        </div>
      )}
    </div>
  );
}
