import { useGetAdminStats } from "@workspace/api-client-react";
import { formatNumber } from "@/lib/utils";

function StatCard({
  label, value, emoji, color, sub,
}: {
  label: string;
  value: number | string;
  emoji: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <span className="text-2xl">{emoji}</span>
      </div>
      <div className={`text-3xl font-bold ${color}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetAdminStats();

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-2xl h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 bg-red-50 rounded-xl p-4">
          Failed to load stats: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Farm Clicker management overview</p>
        </div>
        <div className="text-xs text-gray-400">Live</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={s?.totalUsers ?? 0}
          emoji="👥"
          color="text-blue-600"
        />
        <StatCard
          label="VIP Members"
          value={s?.vipUsers ?? 0}
          emoji="💎"
          color="text-purple-600"
          sub={s?.totalUsers ? `${Math.round((s.vipUsers / s.totalUsers) * 100)}% of users` : undefined}
        />
        <StatCard
          label="Banned Users"
          value={s?.bannedUsers ?? 0}
          emoji="🚫"
          color={s?.bannedUsers ? "text-red-600" : "text-gray-400"}
        />
        <StatCard
          label="Coins in Circulation"
          value={s?.totalCoinsInCirculation ?? 0}
          emoji="🪙"
          color="text-yellow-600"
        />
        <StatCard
          label="Pending Withdrawals"
          value={s?.pendingWithdrawals ?? 0}
          emoji="💸"
          color={s?.pendingWithdrawals ? "text-red-600" : "text-gray-900"}
          sub={s?.pendingWithdrawals ? "Requires action" : "All clear"}
        />
        <StatCard
          label="Pending VIP Requests"
          value={s?.pendingVipPurchases ?? 0}
          emoji="⏳"
          color={s?.pendingVipPurchases ? "text-orange-600" : "text-gray-900"}
          sub={s?.pendingVipPurchases ? "Requires review" : "All clear"}
        />
        <StatCard
          label="Completed Withdrawals"
          value={s?.totalWithdrawalsCompleted ?? 0}
          emoji="✅"
          color="text-green-600"
        />
        <StatCard
          label="Active Users"
          value={s?.activeUsers ?? 0}
          emoji="🌱"
          color="text-emerald-600"
        />
      </div>

      {((s?.pendingWithdrawals ?? 0) > 0 || (s?.pendingVipPurchases ?? 0) > 0) && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold text-sm">Pending actions require your attention</span>
          </div>
          <div className="mt-2 flex gap-3 text-sm text-amber-700">
            {!!s && s.pendingWithdrawals > 0 && (
              <span>{s.pendingWithdrawals} withdrawal{s.pendingWithdrawals > 1 ? "s" : ""} pending</span>
            )}
            {!!s && s.pendingVipPurchases > 0 && (
              <span>{s.pendingVipPurchases} VIP request{s.pendingVipPurchases > 1 ? "s" : ""} pending</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
