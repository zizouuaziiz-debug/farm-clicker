import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Copy, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Clock } from "lucide-react";
import { GameCard, GameButton } from "@/components/ui/game-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useGetDepositWallet,
  useSubmitDeposit,
  useGetDepositHistory,
  getGetDepositHistoryQueryKey,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={13} />,
  completed: <CheckCircle2 size={13} />,
  failed: <AlertCircle size={13} />,
};

export default function Deposit() {
  const queryClient = useQueryClient();
  const { data: walletInfo, isLoading: loadingWallet } = useGetDepositWallet();
  const { data: history = [], isLoading: loadingHistory } = useGetDepositHistory({
    query: { queryKey: getGetDepositHistoryQueryKey() },
  });
  const submitDeposit = useSubmitDeposit();

  const [txHash, setTxHash] = useState("");
  const [amountUsdt, setAmountUsdt] = useState("");
  const [view, setView] = useState<"form" | "history">("form");
  const [lastResult, setLastResult] = useState<{
    status: string;
    message: string;
    coinsCredit?: number;
    failReason?: string;
  } | null>(null);

  const copyWallet = () => {
    if (!walletInfo?.walletAddress) return;
    navigator.clipboard.writeText(walletInfo.walletAddress);
    toast.success("Wallet address copied!");
  };

  const handleSubmit = async () => {
    const amount = parseFloat(amountUsdt);
    if (!txHash.trim() || isNaN(amount) || amount <= 0) {
      toast.error("Please fill in all fields correctly.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      toast.error("Transaction hash must start with 0x followed by 64 hex characters.");
      return;
    }

    try {
      const result = await submitDeposit.mutateAsync({
        data: { txHash: txHash.trim(), amountUsdt: amount },
      });
      setLastResult({
        status: result.status,
        message: result.message ?? "Deposit processed.",
        coinsCredit: result.coinsCredit,
      });
      queryClient.invalidateQueries({ queryKey: getGetDepositHistoryQueryKey() });
      if (result.status === "completed") {
        setTxHash("");
        setAmountUsdt("");
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: { failReason?: string; error?: string } })?.data;
      const reason = errorData?.failReason ?? errorData?.error ?? "Verification failed.";
      setLastResult({ status: "failed", message: reason });
    }
  };

  const walletAddress = walletInfo?.walletAddress ?? "";
  const qrUrl = walletAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(walletAddress)}&margin=2`
    : "";

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <GameCard className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-emerald-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💰</span>
            <div>
              <h1 className="font-display font-bold text-xl leading-none">Deposit USDT</h1>
              <p className="text-sm opacity-90 mt-0.5">
                BEP20 (Binance Smart Chain) · Auto-verified
              </p>
            </div>
          </div>
          {walletInfo && (
            <p className="mt-2 text-sm opacity-80">
              1 USDT = {walletInfo.coinsPerUsdt?.toLocaleString() ?? "?"} coins
            </p>
          )}
        </GameCard>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("form")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            view === "form"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setView("history")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            view === "history"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="space-y-4"
          >
            {/* Result banner */}
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  lastResult.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : lastResult.status === "pending"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-red-50 border-red-200"
                }`}
              >
                {lastResult.status === "completed" ? (
                  <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />
                ) : lastResult.status === "pending" ? (
                  <Clock className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                ) : (
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {lastResult.status === "completed"
                      ? "Deposit Verified! ✅"
                      : lastResult.status === "pending"
                        ? "Pending Review"
                        : "Verification Failed"}
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">{lastResult.message}</p>
                  {lastResult.coinsCredit && lastResult.coinsCredit > 0 && (
                    <p className="text-xs font-bold text-green-700 mt-1">
                      +{lastResult.coinsCredit.toLocaleString()} coins added!
                    </p>
                  )}
                </div>
                <button
                  className="ml-auto text-gray-400 hover:text-gray-600"
                  onClick={() => setLastResult(null)}
                >
                  ×
                </button>
              </motion.div>
            )}

            {/* Wallet address card */}
            {loadingWallet ? (
              <div className="h-32 bg-muted animate-pulse rounded-2xl" />
            ) : walletAddress ? (
              <GameCard className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Send USDT (BEP20) to this address
                </p>
                <div className="flex gap-4 items-center">
                  {qrUrl && (
                    <img
                      src={qrUrl}
                      alt="Wallet QR code"
                      className="w-[90px] h-[90px] rounded-xl border border-border shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] break-all text-gray-700 leading-relaxed">
                        {walletAddress}
                      </code>
                    </div>
                    <button
                      onClick={copyWallet}
                      className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                    >
                      <Copy size={13} />
                      Copy address
                    </button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl p-2">
                  ⚠️ Only send USDT on the <strong>Binance Smart Chain (BEP20)</strong> network.
                  Sending on TRC20 or ERC20 will result in lost funds.
                </div>
              </GameCard>
            ) : (
              <GameCard>
                <p className="text-sm text-muted-foreground text-center">
                  Deposit wallet not configured yet. Contact support.
                </p>
              </GameCard>
            )}

            {/* Form */}
            <GameCard className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="amountUsdt">Amount Sent (USDT)</Label>
                <Input
                  id="amountUsdt"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10.00"
                  value={amountUsdt}
                  onChange={(e) => setAmountUsdt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txHash">Transaction Hash (TxID)</Label>
                <Input
                  id="txHash"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Find this on BscScan after your transfer completes.
                </p>
              </div>

              <GameButton
                className="w-full"
                onClick={handleSubmit}
                disabled={submitDeposit.isPending || !walletAddress}
              >
                {submitDeposit.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Verifying on-chain…
                  </span>
                ) : (
                  "Verify & Claim Coins"
                )}
              </GameButton>
            </GameCard>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-3"
          >
            {loadingHistory ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />
              ))
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">No deposits yet</p>
              </div>
            ) : (
              history.map((d) => (
                <GameCard key={d.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{d.amountUsdt} USDT</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_ICONS[d.status]}
                      {d.status}
                    </span>
                  </div>
                  {d.coinsCredit > 0 && (
                    <p className="text-xs font-semibold text-green-600">
                      +{d.coinsCredit.toLocaleString()} coins
                    </p>
                  )}
                  {d.failReason && (
                    <p className="text-xs text-red-600">{d.failReason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono break-all">
                    {d.txHash}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </GameCard>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
