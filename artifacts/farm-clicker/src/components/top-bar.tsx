import { useAuth } from "@/components/auth-provider";
import { CoinDisplay, XpDisplay } from "@/components/ui/game-ui";
import { Zap, PlayCircle } from "lucide-react";
import { useRefillEnergy, useGetAdsStatus, getGetAdsStatusQueryKey } from "@/api-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@/api-client";
import { useRewardedAd } from "@/hooks/use-rewarded-ad";
import { useEffect, useState } from "react";

const ENERGY_REGEN_INTERVAL_MS = 3 * 60 * 1000;

function useEnergyRegenTimer(energy: number, maxEnergy: number) {
  const [secsUntilRegen, setSecsUntilRegen] = useState<number | null>(null);

  useEffect(() => {
    if (energy >= maxEnergy) {
      setSecsUntilRegen(null);
      return;
    }
    // Countdown from interval since page load (approximate)
    const startMs = Date.now() % ENERGY_REGEN_INTERVAL_MS;
    const remaining = Math.ceil((ENERGY_REGEN_INTERVAL_MS - startMs) / 1000);
    setSecsUntilRegen(remaining);

    const id = setInterval(() => {
      setSecsUntilRegen(prev => {
        if (prev === null) return null;
        if (prev <= 1) return Math.ceil(ENERGY_REGEN_INTERVAL_MS / 1000);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [energy, maxEnergy]);

  return secsUntilRegen;
}

export function TopBar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const refillEnergy = useRefillEnergy();
  const energyAd = useRewardedAd("energy");
  const { data: adsStatus } = useGetAdsStatus({ query: { queryKey: getGetAdsStatusQueryKey() } });
  const secsUntilRegen = useEnergyRegenTimer(user?.energy ?? 0, user?.maxEnergy ?? 50);

  if (!user) return null;

  const handleRefill = () => {
    if (user.energy >= user.maxEnergy) {
      toast("Energy is already full!");
      return;
    }
    if (user.coins < 50) {
      toast.error("Not enough coins to refill! (costs 50🪙)");
      return;
    }
    refillEnergy.mutate(undefined, {
      onSuccess: (data) => {
        toast.success("Energy refilled! ⚡");
        queryClient.setQueryData(getGetMeQueryKey(), data);
      },
      onError: () => toast.error("Failed to refill energy."),
    });
  };

  const handleWatchAdForEnergy = async () => {
    if (user.energy >= user.maxEnergy) {
      toast("Energy is already full!");
      return;
    }
    try {
      await energyAd.watch();
      toast.success("Energy refilled from ad! ⚡");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't watch ad. Try again soon.");
    }
  };

  const energyPercent = Math.min(100, (user.energy / user.maxEnergy) * 100);
  const energyColor = energyPercent > 60 ? "text-cyan-700" : energyPercent > 25 ? "text-amber-600" : "text-red-600";
  const regenMins = secsUntilRegen !== null ? Math.ceil(secsUntilRegen / 60) : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b-2 border-border pt-safe">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* User info */}
        <div className="flex items-center gap-2">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="avatar" className="w-10 h-10 rounded-full border-2 border-primary" />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center font-display font-bold text-primary">
              {user.firstName?.charAt(0) || user.username.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-display font-bold text-sm leading-tight">{user.username}</span>
            <XpDisplay xp={user.xp} level={user.level} className="scale-75 origin-left -ml-1 mt-0.5" />
          </div>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-3">
          {/* Energy */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefill}
                className="flex items-center gap-1 bg-cyan-100/50 border border-cyan-200 px-2.5 py-1 rounded-full active:scale-95 transition-transform"
              >
                <Zap size={16} className="text-cyan-500 fill-cyan-500" />
                <span className={`font-display font-bold text-sm ${energyColor}`}>
                  {user.energy}/{user.maxEnergy}
                </span>
              </button>
              {user.energy < user.maxEnergy && adsStatus?.energyAd.available && (
                <button
                  onClick={handleWatchAdForEnergy}
                  disabled={energyAd.isBusy}
                  title="Watch an ad for free energy"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500 text-white active:scale-90 transition-transform"
                >
                  <PlayCircle size={14} />
                </button>
              )}
            </div>
            {/* Regen timer */}
            {user.energy < user.maxEnergy && regenMins !== null && (
              <span className="text-[9px] text-cyan-600 font-medium leading-none px-1">
                +1 in ~{regenMins}m
              </span>
            )}
          </div>

          <CoinDisplay amount={user.coins} />
        </div>
      </div>
    </header>
  );
}
