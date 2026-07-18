import { useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/admin-auth";

interface LogEntry {
  id: number;
  adminId: number | null;
  adminName: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-100 text-blue-700",
  update_user: "bg-purple-100 text-purple-700",
  reset_progress: "bg-orange-100 text-orange-700",
  approve_withdrawal: "bg-green-100 text-green-700",
  reject_withdrawal: "bg-red-100 text-red-700",
  approve_vip: "bg-emerald-100 text-emerald-700",
  reject_vip: "bg-red-100 text-red-700",
};

const ACTION_ICONS: Record<string, string> = {
  login: "🔑",
  update_user: "✏️",
  reset_progress: "🔄",
  approve_withdrawal: "✅",
  reject_withdrawal: "❌",
  approve_vip: "💎",
  reject_vip: "🚫",
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(p: number) {
    setLoading(true);
    try {
      const data = await fetchAdmin<{ logs: LogEntry[]; total: number }>(
        `/api/admin/logs?page=${p}&limit=50`
      );
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load is stable within component scope
  useEffect(() => { load(page); }, [page]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total entries</p>
        </div>
        <button
          onClick={() => load(page)}
          className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 rounded-xl p-4 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No activity logs yet</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">{ACTION_ICONS[log.action] || "📝"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{log.adminName}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    {log.targetType && log.targetId && (
                      <span className="text-xs text-gray-400">
                        {log.targetType} #{log.targetId}
                      </span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{log.details}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-gray-400 whitespace-nowrap">{formatRelative(log.createdAt)}</div>
                  {log.ipAddress && log.ipAddress !== "unknown" && (
                    <div className="text-xs text-gray-300 mt-0.5">{log.ipAddress}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < 50 || loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
