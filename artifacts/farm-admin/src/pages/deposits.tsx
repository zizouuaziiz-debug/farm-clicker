import { useState } from "react";
import {
  useGetAdminDeposits,
  useReverifyDeposit,
  getGetAdminDepositsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";

const STATUS_OPTIONS = ["all", "pending", "completed", "failed"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function statusBadge(status: string) {
  if (status === "completed") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">✅ Completed</span>;
  if (status === "failed") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">❌ Failed</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">⏳ Pending</span>;
}

export default function Deposits() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const queryParams = {
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    limit,
    offset: page * limit,
  };

  const { data, isLoading, error } = useGetAdminDeposits(queryParams);
  const reverify = useReverifyDeposit();

  const handleReverify = (id: number) => {
    reverify.mutate(
      { id },
      {
        onSuccess: (result: any) => {
          if (result.success) {
            toast.success(`Deposit #${id} verified — $${result.amountUsdt?.toFixed(2) ?? ""} USDT credited`);
          } else {
            toast.error(`Re-verification failed: ${result.error || "Unknown"}`);
          }
          queryClient.invalidateQueries({ queryKey: getGetAdminDepositsQueryKey({}) });
        },
        onError: () => toast.error("Re-verification request failed"),
      },
    );
  };

  const deposits = data?.deposits ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">💳 Deposits</h1>
        <p className="text-sm text-gray-500 mt-1">BEP20 USDT deposits — {total} total</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${statusFilter === s ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16"><Loader2 className="animate-spin text-green-600" size={28} /></div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-sm">Failed to load deposits</div>
        ) : deposits.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No deposits found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["#", "User", "Amount", "Status", "Tx Hash", "Conf.", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">@{d.username}</div>
                      <div className="text-xs text-gray-400 font-mono">{d.telegramId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold">${Number(d.amountUsdt).toFixed(2)}</span>
                      <span className="text-xs text-gray-400 ml-1">USDT</span>
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(d.status)}
                      {d.failReason && <div className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={d.failReason}>{d.failReason}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-gray-600">{d.txHash.slice(0, 8)}…{d.txHash.slice(-6)}</code>
                        <a href={`https://bscscan.com/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><ExternalLink size={11} /></a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{d.confirmations != null ? d.confirmations : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {d.status !== "completed" && (
                        <button onClick={() => handleReverify(d.id)} disabled={reverify.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50">
                          <RefreshCw size={11} className={reverify.isPending ? "animate-spin" : ""} />
                          Re-verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
