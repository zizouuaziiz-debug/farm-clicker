import { useState } from "react";
import {
  useGetAdminWithdrawals,
  useApproveWithdrawal,
  useRejectWithdrawal,
  type GetAdminWithdrawalsStatus,
} from "@workspace/api-client-react";
import { formatDate, formatNumber } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const NETWORK_COLORS: Record<string, string> = {
  TRC20: "bg-red-50 text-red-700",
  ERC20: "bg-blue-50 text-blue-700",
  BEP20: "bg-yellow-50 text-yellow-700",
};

export default function Withdrawals() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: withdrawals, isLoading, refetch } = useGetAdminWithdrawals({
    status: statusFilter as GetAdminWithdrawalsStatus,
  });
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  async function handleApprove(id: number) {
    if (!txHashInput.trim()) { alert("Enter a transaction hash"); return; }
    await approve.mutateAsync({ id, data: { txHash: txHashInput.trim() } });
    setApprovingId(null);
    setTxHashInput("");
    setApproveNotes("");
    refetch();
  }

  async function handleReject(id: number) {
    await reject.mutateAsync({ id, data: { reason: rejectReason.trim() || undefined } });
    setRejectingId(null);
    setRejectReason("");
    refetch();
  }

  const list = withdrawals ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Withdrawals</h1>
        <div className="flex gap-2">
          {["pending", "processing", "completed", "rejected"].map((s) => (
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
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {statusFilter} withdrawals</div>
      ) : (
        <div className="space-y-3">
          {list.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{w.username}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[w.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {w.status}
                    </span>
                    {w.network && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${NETWORK_COLORS[w.network] ?? "bg-gray-100 text-gray-600"}`}>
                        {w.network}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{formatNumber(w.coinsAmount)} coins</span>
                    {" → "}
                    <span className="font-medium text-green-700">{w.usdtAmount} USDT</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono truncate">{w.usdtWallet}</div>
                  {w.txHash && <div className="text-xs text-blue-600 mt-1 font-mono truncate">TX: {w.txHash}</div>}
                  {w.rejectReason && <div className="text-xs text-red-500 mt-1">Reason: {w.rejectReason}</div>}
                  {w.adminNotes && <div className="text-xs text-gray-500 mt-1 italic">Notes: {w.adminNotes}</div>}
                  <div className="text-xs text-gray-400 mt-1">{formatDate(w.createdAt)}</div>
                </div>

                {w.status === "pending" && (
                  <div className="flex flex-col gap-2 min-w-[130px]">
                    {approvingId === w.id ? (
                      <div className="space-y-2">
                        <input
                          value={txHashInput}
                          onChange={(e) => setTxHashInput(e.target.value)}
                          placeholder="TX Hash"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <input
                          value={approveNotes}
                          onChange={(e) => setApproveNotes(e.target.value)}
                          placeholder="Admin notes (opt.)"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(w.id)} className="flex-1 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">✓ Send</button>
                          <button onClick={() => { setApprovingId(null); setTxHashInput(""); setApproveNotes(""); }} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">✕</button>
                        </div>
                      </div>
                    ) : rejectingId === w.id ? (
                      <div className="space-y-2">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleReject(w.id)} className="flex-1 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">✕</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setApprovingId(w.id)} className="py-1.5 px-3 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                          ✓ Approve
                        </button>
                        <button onClick={() => setRejectingId(w.id)} className="py-1.5 px-3 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
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
