import { useGetAchievements, getGetAchievementsQueryKey } from "@/api-client";
import { GameCard } from "@/components/ui/game-ui";
import { Loader2, Trophy } from "lucide-react";

export default function Achievements() {
  const { data: achievements = [], isLoading } = useGetAchievements({
    query: { queryKey: getGetAchievementsQueryKey() }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 text-white text-center shadow-lg border-b-4 border-indigo-800">
        <Trophy size={40} className="mx-auto mb-2 text-yellow-300 drop-shadow-md" />
        <h1 className="font-display font-bold text-2xl mb-1">Trophy Room</h1>
        <p className="text-purple-100 font-medium">Unlocked {unlockedCount} of {achievements.length}</p>
        <div className="mt-4 bg-black/20 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-yellow-400 h-full" 
            style={{ width: `${(unlockedCount / Math.max(1, achievements.length)) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {achievements.map((a) => (
          <GameCard 
            key={a.id} 
            className={`p-4 flex flex-col items-center text-center transition-all ${
              a.unlocked 
                ? 'bg-gradient-to-b from-card to-amber-50/30 border-amber-200' 
                : 'opacity-60 grayscale bg-muted border-transparent'
            }`}
          >
            <div className="text-4xl mb-2 filter drop-shadow-sm">
              {a.emoji || "🏆"}
            </div>
            <h3 className="font-display font-bold text-sm leading-tight mb-1">{a.title}</h3>
            <p className="text-[10px] text-muted-foreground leading-tight">{a.description}</p>
            
            {a.goal && a.progress !== undefined && !a.unlocked && (
              <div className="w-full mt-3 bg-border h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-muted-foreground h-full" 
                  style={{ width: `${((a.progress ?? 0) / (a.goal ?? 1)) * 100}%` }}
                />
              </div>
            )}
          </GameCard>
        ))}
      </div>
    </div>
  );
}
