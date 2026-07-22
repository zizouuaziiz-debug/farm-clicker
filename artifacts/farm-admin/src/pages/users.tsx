import { useState } from "react";
import { useGetAdminUsers, useUpdateAdminUser, type UserProfile } from "@workspace/api-client-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { fetchAdmin } from "@/lib/admin-auth";
import { toast } from "sonner";

const VIP_NAMES: Record<number, string> = {
  0: "None", 1: "Bronze 🥉", 2: "Silver 🥈", 3: "Gold 🥇", 4: "Diamond 💎", 5: "Platinum 💫",
};

interface EditState {
  coins: number;
  xp: number;
  vipLevel: number;
}

export default function Users() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ coins: 0, xp: 0, vipLevel: 0 });
  const [saving, setSaving] = useState(false);
  const [resetConfirmId, setResetConfirmId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useGetAdminUsers({ page, limit: 20, search: query || undefined });
  const updateUser = useUpdateAdminUser();

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  }

  function openEdit(u: UserProfile) {
    setEditUserId(u.id);
    setEditState({ coins: u.coins, xp: u.xp, vipLevel: u.vipLevel });
  }

  async function saveEdit() {
    if (!editUserId) return;
    setSaving(true);
    try {
      await fetchAdmin(`/api/admin/users/${editUserId}`, {
        method: "PATCH",
        body: JSON.stringify(editState),
      });
      toast.success("User updated");
      setEditUserId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBan(userId: number, isBanned: boolean | undefined) {
    try {
      await updateUser.mutateAsync({ id: userId, data: { isBanned: !isBanned } });
      toast.success(isBanned ? "User unbanned" : "User banned");
      refetch();
    } catch {
      toast.error("Failed to update user");
    }
  }

  async function confirmReset(userId: number) {
    setSaving(true);
    try {
      await fetchAdmin(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ resetProgress: true }),
      });
      toast.success("User progress reset");
      setResetConfirmId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <span className="text-sm text-gray-500">{formatNumber(total)} total</span>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or Telegram ID..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button type="submit" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors">
          Search
        </button>
        {query && (
          <button type="button" onClick={() => { setQuery(""); setSearch(""); setPage(1); }} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
            Clear
          </button>
        )}
      </form>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Level</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Coins</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">VIP</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
  {u.firstName || u.lastName
    ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
    : u.username || `User ${u.telegramId}`}
</div>
                      <div className="text-xs text-gray-400">TG: {u.telegramId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-gray-700">⭐ {u.level}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatNumber(u.coins)}</td>
                    <td className="px-4 py-3">
                      {u.vipLevel > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {VIP_NAMES[u.vipLevel] || `VIP ${u.vipLevel}`}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.isBanned && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Banned</span>}
                        {u.isAdmin && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Admin</span>}
                        {!u.isBanned && !u.isAdmin && <span className="text-xs text-green-600">Active</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => toggleBan(u.id, u.isBanned)}
                          disabled={updateUser.isPending}
                          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${u.isBanned ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                        >
                          {u.isBanned ? "Unban" : "Ban"}
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setResetConfirmId(u.id)}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} · {formatNumber(total)} users</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Next →
          </button>
        </div>
      )}

      {editUserId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Edit User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coins</label>
                <input
                  type="number"
                  min={0}
                  value={editState.coins}
                  onChange={(e) => setEditState(s => ({ ...s, coins: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">XP</label>
                <input
                  type="number"
                  min={0}
                  value={editState.xp}
                  onChange={(e) => setEditState(s => ({ ...s, xp: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIP Level</label>
                <select
                  value={editState.vipLevel}
                  onChange={(e) => setEditState(s => ({ ...s, vipLevel: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{VIP_NAMES[v] || `VIP ${v}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditUserId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Reset Progress?</h2>
            <p className="text-sm text-gray-500 mb-6">This will reset all coins, XP, VIP, and harvests for this user. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmReset(resetConfirmId)}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Resetting..." : "Reset Progress"}
              </button>
              <button
                onClick={() => setResetConfirmId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
