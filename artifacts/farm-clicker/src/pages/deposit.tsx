import { useState } from "react";
import {
  useGetDepositWallet,
  useGetDepositHistory,
  useSubmitDeposit,
  getGetDepositHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, CheckCircle2, AlertCircle, Clock, Wallet } from "lucide-react";

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function statusLabel(status: string) {
  if (status === "completed") return "✅ Completed";
  if (status === "failed") return "❌ Failed";
  return "⏳ Pending";
}

export default function Deposit() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: loadingWallet } = useGetDepositWallet();
  const { data: history = [], isLoading: loadingHistory } = useGetDepositHistory();
  const submitDeposit = useSubmitDeposit();

  const [txHash, setTxHash] = useState("");
  const [amountUsdt, setAmountUsdt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<{ amountUsdt: number; usdtBalance: number } | null>(null);

  const copyWallet = () => {
    if (!wallet?.walletAddress) return;
    navigator.clipboard.writeText(wallet.walletAddress);
    toast.success("Wallet address copied");
  };

  const handleSubmit = () => {
    const amount = parseFloat(amountUsdt);
    if (!txHash.trim()) { toast.error("Please enter the transaction hash"); return; }
    if (!txHash.trim().startsWith("0x") || txHash.trim().length !== 66) {
      toast.error("Invalid transaction hash — must start with 0x and be 66 characters");
      return;
    }
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    if (wallet && amount < wallet.minDepositUsdt) {
      toast.error(`Minimum deposit is ${wallet.minDepositUsdt} USDT`); return;
    }

    submitDeposit.mutate(
      { data: { txHash: txHash.trim(), amountUsdt: amount } },
      {
        onSuccess: (data) => {
          setSubmitted(true);
          setLastResult({ amountUsdt: data.amountUsdt, usdtBalance: data.usdtBalance });
          queryClient.invalidateQueries({ queryKey: getGetDepositHistoryQueryKey() });
          toast.success(`${data.amountUsdt.toFixed(2)} USDT credited!`);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || "Verification failed. Check your tx hash and try again.";
          toast.error(msg);
        },
      },
    );
  };

  if (loadingWallet) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Wallet size={28} />
            <div>
              <h2 className="font-bold text-lg leading-none">USDT Deposit</h2>
              <p className="text-sm opacity-90">BEP20 · BNB Smart Chain</p>
            </div>
          </div>
          <p className="text-xs opacity-80">
            Send USDT (BEP20) to the address below, then submit your transaction hash for automatic verification.
          </p>
        </div>
      </motion.div>

      {/* Wallet & QR */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit Wallet</h3>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl border">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(wallet?.walletAddress || "")}`}
                alt="QR Code"
                className="w-36 h-36 rounded"
              />
            </div>
          </div>
          <div className="bg-muted/60 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">BEP20 Address</span>
              <button onClick={copyWallet} className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-70 transition-opacity">
                <Copy size={12} /> Copy
              </button>
            </div>
            <code className="text-[11px] break-all text-foreground leading-relaxed">{wallet?.walletAddress}</code>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Send only <strong>USDT BEP20</strong> on BNB Smart Chain. Min: <strong>${wallet?.minDepositUsdt} USDT</strong></span>
          </div>
        </div>
      </motion.div>

      {/* Submit Form */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-2xl border bg-card p-4 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submit Deposit</h3>
          <AnimatePresence mode="wait">
            {submitted && lastResult ? (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-4 space-y-3">
                <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
                <div>
                  <p className="font-bold text-lg">Deposit Verified!</p>
                  <p className="text-muted-foreground text-sm"><strong className="text-foreground">${lastResult.amountUsdt.toFixed(2)} USDT</strong> added to your balance.</p>
                  <p className="text-xs text-muted-foreground mt-1">New balance: <strong>${lastResult.usdtBalance.toFixed(2)} USDT</strong></p>
                </div>
                <Button variant="outline" onClick={() => { setTxHash(""); setAmountUsdt(""); setSubmitted(false); setLastResult(null); }} className="w-full">
                  Submit Another
                </Button>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="txHash">Transaction Hash (TxID)</Label>
                  <Input id="txHash" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Find this in your wallet or on BscScan</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount Sent (USDT)</Label>
                  <Input id="amount" type="number" min={wallet?.minDepositUsdt ?? 5} step="0.01" value={amountUsdt} onChange={(e) => setAmountUsdt(e.target.value)} placeholder={`Min ${wallet?.minDepositUsdt ?? 5} USDT`} />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={submitDeposit.isPending}>
                  {submitDeposit.isPending ? <><Loader2 className="animate-spin mr-2" size={16} />Verifying on BscScan…</> : "Verify & Credit Balance"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">Verification is automatic — balance credited instantly on success.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* History */}
      {(loadingHistory || history.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit History</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
            ) : (
              <div className="space-y-2">
                {history.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusVariant(d.status)} className="text-[10px] h-5">{statusLabel(d.status)}</Badge>
                        <span className="font-bold text-sm">${Number(d.amountUsdt).toFixed(2)}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground break-all">{d.txHash.slice(0, 18)}…{d.txHash.slice(-6)}</code>
                      {d.failReason && <p className="text-[10px] text-destructive mt-1">{d.failReason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</p>
                      {d.confirmations != null && (
                        <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5"><Clock size={10} />{d.confirmations} conf.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
