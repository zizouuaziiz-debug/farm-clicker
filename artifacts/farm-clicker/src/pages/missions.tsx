import { useGetMissions, useClaimMissionReward, getGetMissionsQueryKey, getGetMeQueryKey } from "@/api-client";
import { GameCard, GameButton, CoinDisplay, XpDisplay } from "@/components/ui/game-ui";
import { Loader2, Target, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Missions() {
  const queryClient = useQueryClient();
  const { data: missions = [], isLoading } = useGetMissions({
    query: { queryKey: getGetMissionsQueryKey() }
  });
  const claimMission = useClaimMissionReward();

  const handleClaim = (id: number) => {
    claimMission.mutate({ id }, {
      onSuccess: (updatedUser) => {
        toast.success("Reward claimed! 🎉");
        queryClient.invalidateQueries({ queryKey: getGetMissionsQueryKey() });
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
      },
      onError: () => toast.error("Failed to claim reward.")
    });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const claimedCount = missions.filter(m => m.claimed).length;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-xl flex items-center justify-center border border-blue-200">
            <Target size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl leading-none">Daily Missions</h1>
            <p className="text-muted-foreground text-sm">Resets every 24 hours</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display font-bold text-sm text-primary">{claimedCount}/{missions.length}</p>
          <p className="text-xs text-muted-foreground">Claimed</p>
        </div>
      </div>

      <div className="space-y-3">
        {missions.map((mission) => {
          const percent = Math.min(100, (mission.progress / mission.goal) * 100);
          const canClaim = mission.completed && !mission.claimed;

          return (
            <GameCard
              key={mission.id}
              className={`p-4 transition-all ${
                mission.claimed
                  ? "bg-green-50/50 border-green-200 opacity-70"
                  : canClaim
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400 ring-offset-1"
                  : ""
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 pr-4">
                  <h3 className="font-display font-bold text-lg leading-tight mb-1">
                    {mission.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{mission.description}</p>
                </div>

                {mission.claimed ? (
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <CheckCircle2 size={28} className="text-green-500 fill-green-100" />
                    <span className="text-[10px] font-bold text-green-600">Claimed</span>
                  </div>
                ) : canClaim ? (
                  <GameButton
                    size="sm"
                    variant="accent"
                    disabled={claimMission.isPending}
                    onClick={() => handleClaim(mission.id)}
                    className="shrink-0 bg-amber-500 border-amber-700 text-white"
                  >
                    Claim!
                  </GameButton>
                ) : (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {mission.reward.coins > 0 && (
                      <CoinDisplay amount={mission.reward.coins} className="text-[10px] py-0.5 px-1.5" />
                    )}
                    {mission.reward.xp > 0 && (
                      <XpDisplay xp={mission.reward.xp} level={0} className="text-[10px] py-0.5 px-1.5" />
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      mission.claimed
                        ? "bg-green-400"
                        : canClaim
                        ? "bg-amber-400"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-muted-foreground w-14 text-right">
                  {mission.progress}/{mission.goal}
                </span>
              </div>
            </GameCard>
          );
        })}
      </div>
    </div>
  );
}
