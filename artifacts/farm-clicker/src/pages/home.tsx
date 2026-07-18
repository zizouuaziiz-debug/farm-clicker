import { useGetDashboard } from "@/api-client";
import { Link } from "wouter";
import { Calendar, Target, Award, BarChart3, ChevronRight, Sprout, Crown, ArrowDownToLine, ShieldCheck, Users } from "lucide-react";
import { GameCard } from "@/components/ui/game-ui";
import { useAuth } from "@/components/auth-provider";

export default function Home() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-32 bg-muted rounded-3xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded-3xl" />
          <div className="h-24 bg-muted rounded-3xl" />
        </div>
        <div className="h-48 bg-muted rounded-3xl" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="p-4 space-y-6">
      
      {/* Farm Status Alert */}
      {(dashboard.readyToHarvest > 0 || (dashboard.needsWater ?? 0) > 0) ? (
        <Link href="/farm">
          <div className="bg-gradient-to-r from-orange-400 to-amber-400 rounded-3xl p-1 shadow-md active:scale-[0.98] transition-transform">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30 text-white flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-xl drop-shadow-sm">Farm Needs You!</h2>
                <p className="text-sm font-medium opacity-90">
                  {dashboard.readyToHarvest > 0 && `${dashboard.readyToHarvest} ready to harvest `}
                  {(dashboard.needsWater ?? 0) > 0 && `• ${(dashboard.needsWater ?? 0)} needs water`}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center">
                <Sprout size={28} className="text-white drop-shadow-sm" />
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <GameCard className="bg-gradient-to-r from-primary/80 to-primary/90 text-primary-foreground border-primary-border flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl">All Quiet</h2>
            <p className="text-sm opacity-90">Your farm is growing nicely.</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🌱</span>
          </div>
        </GameCard>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/daily" className="block">
          <GameCard className={`flex flex-col items-center justify-center gap-2 p-4 active:scale-95 transition-transform ${!dashboard.todayClaimed ? 'border-primary ring-2 ring-primary ring-offset-2 bg-green-50' : ''}`}>
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 border border-amber-200">
                <Calendar size={24} />
              </div>
              {!dashboard.todayClaimed && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border border-white"></span>
                </span>
              )}
            </div>
            <span className="font-display font-bold text-sm text-center">Daily Reward</span>
          </GameCard>
        </Link>

        <Link href="/missions" className="block">
          <GameCard className="flex flex-col items-center justify-center gap-2 p-4 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 border border-blue-200">
              <Target size={24} />
            </div>
            <span className="font-display font-bold text-sm text-center">Missions</span>
          </GameCard>
        </Link>
      </div>

      {/* Menu List */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-muted-foreground uppercase text-xs tracking-wider px-2">More Options</h3>
        
        <Link href="/achievements">
          <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-500 flex items-center justify-center border border-purple-200">
                <Award size={20} />
              </div>
              <span className="font-display font-bold text-lg">Achievements</span>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </GameCard>
        </Link>

        <Link href="/stats">
          <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-100 text-pink-500 flex items-center justify-center border border-pink-200">
                <BarChart3 size={20} />
              </div>
              <span className="font-display font-bold text-lg">Statistics</span>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </GameCard>
        </Link>

        <Link href="/vip">
          <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center border border-yellow-200">
                <Crown size={20} />
              </div>
              <span className="font-display font-bold text-lg">VIP Subscription</span>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </GameCard>
        </Link>

        <Link href="/withdraw">
          <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <ArrowDownToLine size={20} />
              </div>
              <span className="font-display font-bold text-lg">Withdraw</span>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </GameCard>
        </Link>

        <Link href="/invite">
          <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Users size={20} />
              </div>
              <span className="font-display font-bold text-lg">Invite Friends</span>
            </div>
            <ChevronRight className="text-muted-foreground" size={20} />
          </GameCard>
        </Link>

        {user?.isAdmin && (
          <Link href="/admin">
            <GameCard className="flex items-center justify-between p-4 active:bg-muted transition-colors border-primary">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                  <ShieldCheck size={20} />
                </div>
                <span className="font-display font-bold text-lg">Admin Panel</span>
              </div>
              <ChevronRight className="text-muted-foreground" size={20} />
            </GameCard>
          </Link>
        )}
      </div>
    </div>
  );
}
