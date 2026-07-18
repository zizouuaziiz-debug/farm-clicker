import { useState } from "react";
import {
  useGetVipPlans,
  useGetVipStatus,
  useGetVipPurchases,
  useSubmitVipPurchase,
  getGetVipStatusQueryKey,
  getGetVipPurchasesQueryKey,
  getGetMeQueryKey,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { GameCard, GameButton } from "@/components/ui/game-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, Loader2, Crown, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type PurchaseResult = {
  status: "approved" | "rejected" | "pending";
  message: string;
};

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function Vip() {
  const queryClient = useQueryClient();
  const { data: plansData, isLoading: loadingPlans } = useGetVipPlans();
  const { data: vipStatus } = useGetVipStatus({ query: { queryKey: getGetVipStatusQueryKey() } });
  const { data: purchases = [] } = useGetVipPurchases({ query: { queryKey: getGetVipPurchasesQueryKey() } });
  const submitPurchase = useSubmitVipPurchase();

  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);

  const selectedPlan = plansData?.plans.find((p) => p.tier === selectedTier);

  const walletAddress = plansData?.walletAddress ?? "";
  const qrUrl = walletAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(walletAddress)}&margin=2`
    : "";

  const copyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success("Wallet address copied");
  };

  const openPlan = (tier: number) => {
    setSelectedTier(tier);
    setTxHash("");
    setResult(null);
  };

  const closeModal = () => {
    setSelectedTier(null);
    setTxHash("");
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!selectedTier) return;
    if (!txHash.trim()) {
      toast.error("Please enter the transaction hash");
      return;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      toast.error("Invalid transaction hash. Must start with 0x followed by 64 hex characters.");
      return;
    }

    try {
      const res = await submitPurchase.mutateAsync({
        data: { tier: selectedTier, txHash: txHash.trim() },
      });

      setResult({ status: res.status as PurchaseResult["status"], message: res.message });

      if (res.status === "approved") {
        // Refresh VIP status + user profile to reflect new tier and energy
        queryClient.invalidateQueries({ queryKey: getGetVipStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVipPurchasesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      } else {
        queryClient.invalidateQueries({ queryKey: getGetVipPurchasesQueryKey() });
      }
    } catch (err: unknown) {
      const errData = (err as { data?: { failReason?: string; error?: string } })?.data;
      const reason = errData?.failReason ?? errData?.error ?? "Verification failed. Please try again.";
      setResult({ status: "rejected", message: reason });
    }
  };

  if (loadingPlans) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Active VIP banner */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {vipStatus?.active ? (
          <GameCard className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-amber-600 flex items-center gap-3">
            <Crown size={32} className="drop-shadow" />
            <div>
              <h2 className="font-display font-bold text-lg leading-none">
                VIP {["", "Bronze", "Silver", "Gold", "Diamond", "Platinum"][vipStatus.vipLevel] ?? `Tier ${vipStatus.vipLevel}`} Active
              </h2>
              {vipStatus.vipExpiresAt && (
                <p className="text-sm opacity-90">
                  Expires {new Date(vipStatus.vipExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </GameCard>
        ) : (
          <GameCard className="flex items-center gap-3 text-muted-foreground">
            <Crown size={28} />
            <p className="font-display font-bold">No active VIP subscription</p>
          </GameCard>
        )}
      </motion.div>

      {/* Plans */}
      <div className="space-y-4">
        {plansData?.plans.map((plan, i) => (
          <motion.div
            key={plan.tier}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <GameCard className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{plan.emoji}</span>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-none">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.durationDays} days</p>
                  </div>
                </div>
                <span className="font-display font-bold text-xl text-primary">${plan.priceUsdt}</span>
              </div>
              <ul className="space-y-1 mb-3 text-sm">
                {plan.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-primary shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <GameButton className="w-full" size="sm" onClick={() => openPlan(plan.tier)}>
                Subscribe
              </GameButton>
            </GameCard>
          </motion.div>
        ))}
      </div>

      {/* Purchase history */}
      {purchases.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display font-bold text-muted-foreground uppercase text-xs tracking-wider px-2">
            History
          </h3>
          {purchases.map((p) => (
            <GameCard key={p.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-display font-bold text-sm">
                  Tier {p.tier} · ${p.priceUsdt}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
                {p.rejectReason && (
                  <p className="text-xs text-destructive mt-1">{p.rejectReason}</p>
                )}
              </div>
              <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
            </GameCard>
          ))}
        </div>
      )}

      {/* ── Purchase modal ── */}
      <Dialog open={selectedTier !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedPlan
                ? `${selectedPlan.emoji} ${selectedPlan.name} — $${selectedPlan.priceUsdt} USDT`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Send exactly <strong>${selectedPlan?.priceUsdt} USDT</strong> (BEP20 · BSC) to the
              address below, then paste your transaction hash. Activation is instant.
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {result ? (
              /* ── Result screen ── */
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 space-y-4 text-center"
              >
                {result.status === "approved" ? (
                  <>
                    <CheckCircle2 className="mx-auto text-green-500" size={48} />
                    <div>
                      <p className="font-display font-bold text-lg">VIP Activated! 🎉</p>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    </div>
                    <GameButton className="w-full" onClick={closeModal}>
                      Continue
                    </GameButton>
                  </>
                ) : result.status === "pending" ? (
                  <>
                    <Clock className="mx-auto text-yellow-500" size={48} />
                    <div>
                      <p className="font-display font-bold text-lg">Under Review</p>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    </div>
                    <GameButton className="w-full" onClick={closeModal}>
                      OK
                    </GameButton>
                  </>
                ) : (
                  <>
                    <AlertCircle className="mx-auto text-destructive" size={48} />
                    <div>
                      <p className="font-display font-bold text-lg">Verification Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    </div>
                    <div className="flex gap-2">
                      <GameButton
                        className="flex-1"
                        variant="outline"
                        onClick={() => setResult(null)}
                      >
                        Try Again
                      </GameButton>
                      <GameButton className="flex-1" onClick={closeModal}>
                        Close
                      </GameButton>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              /* ── Payment form ── */
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Wallet address + QR */}
                <div className="bg-muted rounded-2xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Send to (BEP20 · BSC only)
                  </p>
                  <div className="flex gap-3 items-center">
                    {qrUrl && (
                      <img
                        src={qrUrl}
                        alt="Wallet QR"
                        className="w-[80px] h-[80px] rounded-xl border border-border shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <code className="text-[11px] break-all text-gray-700 leading-relaxed">
                        {walletAddress}
                      </code>
                      <button
                        onClick={copyWallet}
                        className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                      >
                        <Copy size={12} />
                        Copy address
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-display font-bold">
                    Amount: <span className="text-primary">${selectedPlan?.priceUsdt} USDT</span>
                  </p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5">
                    ⚠️ Only send on <strong>Binance Smart Chain (BEP20)</strong>. Do not use TRC20 or ERC20.
                  </p>
                </div>

                {/* TxHash field only */}
                <div className="space-y-1.5">
                  <Label htmlFor="txHash">Transaction Hash (TxID)</Label>
                  <Input
                    id="txHash"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this on BscScan after your transfer confirms.
                  </p>
                </div>

                <GameButton
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitPurchase.isPending || !txHash.trim()}
                >
                  {submitPurchase.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Verifying on-chain…
                    </span>
                  ) : (
                    "Verify & Activate VIP"
                  )}
                </GameButton>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
