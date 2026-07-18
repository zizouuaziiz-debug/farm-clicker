import { useGetLeaderboard, getGetLeaderboardQueryKey, useGetMe, getGetMeQueryKey } from "@/api-client";
import { GameCard } from "@/components/ui/game-ui";
import { Loader2 } from "lucide-react";

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const VIP_BADGES: Record<number, string> = { 1: "🥈", 2: "🥇", 3: "💎" };

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = useGetLeaderboard({ limit: 50 }, {
    query: { queryKey: getGetLeaderboardQueryKey({ limit: 50 }) }
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const myRank = leaderboard.find(e => e.userId === me?.id);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="font-display font-bold text-3xl mb-1">🏆 Top Farmers</h1>
        <p className="text-muted-foreground text-sm">Ranked by total wealth</p>
      </div>

      {/* My rank sticky banner */}
      {myRank && (
        <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-3 flex items-center gap-3">
          <div className="font-display font-bold text-2xl text-primary w-10 text-center">
            #{myRank.rank}
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-sm">Your position</p>
            <p className="text-xs text-muted-foreground">{myRank.coins.toLocaleString()} 🪙</p>
          </div>
          <span className="text-xl">{RANK_MEDALS[myRank.rank] || "🌱"}</span>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {leaderboard.map((entry) => {
          const isMe = entry.userId === me?.id;
          const medal = RANK_MEDALS[entry.rank];
          const vipBadge = entry.vipLevel > 0 ? VIP_BADGES[entry.vipLevel] || "💎" : null;

          return (
            <GameCard
              key={entry.userId}
              className={`flex items-center p-3 ${isMe ? "ring-2 ring-primary bg-primary/5 border-primary" : ""}`}
            >
              {/* Rank */}
              <div className="w-10 text-center font-display font-bold text-lg shrink-0">
                {medal ? (
                  <span className="text-2xl">{medal}</span>
                ) : (
                  <span className={entry.rank <= 10 ? "text-foreground" : "text-muted-foreground"}>
                    #{entry.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-display font-bold text-primary mx-3 border border-primary/30 shrink-0 overflow-hidden">
                {entry.photoUrl ? (
                  <img src={entry.photoUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (entry.firstName?.charAt(0) || entry.username.charAt(0)).toUpperCase()
                )}
              </div>

              {/* Name + level */}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display font-bold truncate text-[15px]">
                    {entry.username}
                  </h3>
                  {vipBadge && (
                    <span className="text-sm" title={`VIP ${entry.vipLevel}`}>{vipBadge}</span>
                  )}
                  {isMe && (
                    <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-full border border-primary/30">
                      You
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  Lvl {entry.level} · {entry.totalHarvests} harvests
                </p>
              </div>

              {/* Coins */}
              <div className="text-right ml-2 shrink-0">
                <div className="font-display font-bold text-yellow-600">
                  {entry.coins.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">🪙 coins</div>
              </div>
            </GameCard>
          );
        })}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <span className="text-4xl block mb-2">🌱</span>
          <p>No players yet. Be the first!</p>
        </div>
      )}
    </div>
  );
}
