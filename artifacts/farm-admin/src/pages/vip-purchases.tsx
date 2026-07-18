import { useState } from "react";
import {
  useGetAdminVipPurchases,
  useApproveVipPurchase,
  useRejectVipPurchase,
  type GetAdminVipPurchasesStatus,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const VIP_NAMES: Record<number, string> = {
  1: "Bronze", 2: "Silver", 3: "Gold", 4: "Diamond", 5: "Platinum",
};

const VIP_EMOJIS: Record<number, string> = {
  1: "🥉", 2: "🥈", 3: "🥇", 4: "💎", 5: "💫",
};

const VIP_COLORS: Record<number, string> = {
  1: "bg-orange-100 text-orange-800",
  2: "bg-gray-100 text-gray-700",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-blue-100 text-blue-800",
  5: "bg-purple-100 text-purple-800",
};

export default function VipPurchases() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  const { data: purchases, isLoading, refetch } = useGetAdminVipPurchases({
    status: statusFilter as GetAdminVipPurchasesStatus,
  });
  const approve = useApproveVipPurchase();
  const reject = useRejectVipPurchase();

  async function handleApprove(id: number) {
    await approve.mutateAsync({ id });
    setApprovingId(null);
    setApproveNotes("");
    refetch();
  }

  async function handleReject(id: number) {
    await reject.mutateAsync({ id, data: { reason: rejectReason.trim() || undefined } });
    setRejectingId(null);
    setRejectReason("");
    refetch();
  }

  const list = purchases ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VIP Requests</h1>
        <div className="flex gap-2">
          {["pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${statusFilter === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {statusFilter} VIP requests</div>
      ) : (
        <div className="space-y-3">
          {list.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-gray-900">{v.username}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {v.status}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${VIP_COLORS[v.tier] ?? "bg-gray-100 text-gray-700"}`}>
                      {VIP_EMOJIS[v.tier] ?? "💎"} {VIP_NAMES[v.tier] ?? `Tier ${v.tier}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                    <span className="font-medium text-green-700">{v.priceUsdt} USDT</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">{v.durationDays} days</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-xs text-gray-400">User ID: {v.telegramId}</span>
                  </div>
                  <div className="text-xs text-gray-500">From wallet: {v.walletSent}</div>
                  <div className="text-xs text-blue-600 mt-1 font-mono truncate">TxID: {v.txHash}</div>
                  {v.screenshotUrl && (
                    <a href={v.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 block">
                      View screenshot
                    </a>
                  )}
                  {v.rejectReason && <div className="text-xs text-red-500 mt-1">Reason: {v.rejectReason}</div>}
                  {v.adminNotes && <div className="text-xs text-gray-500 mt-1 italic">Notes: {v.adminNotes}</div>}
                  {v.approvedAt && <div className="text-xs text-gray-400 mt-1">Approved: {formatDate(v.approvedAt)}</div>}
                  <div className="text-xs text-gray-400 mt-1">{formatDate(v.createdAt)}</div>
                </div>

                {v.status === "pending" && (
                  <div className="flex flex-col gap-2 min-w-[130px]">
                    {rejectingId === v.id ? (
                      <div className="space-y-2">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleReject(v.id)} className="flex-1 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">✕</button>
                        </div>
                      </div>
                    ) : approvingId === v.id ? (
                      <div className="space-y-2">
                        <input
                          value={approveNotes}
                          onChange={(e) => setApproveNotes(e.target.value)}
                          placeholder="Admin notes (optional)"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(v.id)} className="flex-1 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Confirm</button>
                          <button onClick={() => { setApprovingId(null); setApproveNotes(""); }} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">✕</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setApprovingId(v.id)} className="py-1.5 px-3 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                          ✓ Approve
                        </button>
                        <button onClick={() => setRejectingId(v.id)} className="py-1.5 px-3 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
