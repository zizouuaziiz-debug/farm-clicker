import { useState } from "react";
import {
  useGetAdminDeposits,
  useReverifyDeposit,
  type GetAdminDepositsStatus,
} from "@workspace/api-client-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function Deposits() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const { data: deposits, isLoading, refetch } = useGetAdminDeposits({
    status: statusFilter as GetAdminDepositsStatus,
  });
  const reverify = useReverifyDeposit();

  async function handleReverify(id: number) {
    try {
      const result = await reverify.mutateAsync({ id });
      if (result.success) {
        toast.success(
          result.status === "completed"
            ? `Deposit #${id} verified and ${(result as unknown as { coinsCredit?: number }).coinsCredit?.toLocaleString() ?? "?"} coins credited`
            : "Already completed",
        );
      } else {
        toast.error((result as unknown as { failReason?: string }).failReason ?? "Verification failed");
      }
      refetch();
    } catch {
      toast.error("Re-verification request failed");
    }
  }

  const list = deposits ?? [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposits</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            BEP20 USDT · Auto-verified on-chain
          </p>
        </div>
        <div className="flex gap-2">
          {(["pending", "completed", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                statusFilter === s
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p>No {statusFilter} deposits</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* User + status */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-semibold text-gray-900">{d.username || "—"}</span>
                    <span className="text-xs text-gray-400">@{d.telegramId}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-4 text-sm text-gray-700 mb-1 flex-wrap">
                    <span className="font-bold text-green-700">
                      {d.amountUsdt} USDT
                    </span>
                    {d.coinsCredit > 0 && (
                      <span className="text-blue-600 font-medium">
                        → {d.coinsCredit.toLocaleString()} coins
                      </span>
                    )}
                  </div>

                  {/* TxHash */}
                  <div className="font-mono text-[11px] text-gray-500 break-all mb-1">
                    <span className="text-gray-400 mr-1">TxHash:</span>
                    {d.txHash}
                  </div>

                  {/* Fail reason */}
                  {d.failReason && (
                    <p className="text-xs text-red-600 mt-1">{d.failReason}</p>
                  )}

                  {/* Timestamps */}
                  <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap">
                    <span>Submitted: {new Date(d.createdAt).toLocaleString()}</span>
                    {d.verifiedAt && (
                      <span>Verified: {new Date(d.verifiedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Re-verify button */}
                <div className="shrink-0">
                  <button
                    onClick={() => handleReverify(d.id)}
                    disabled={reverify.isPending}
                    className="py-1.5 px-3 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {reverify.isPending ? "…" : "🔄 Re-verify"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
