import { useState } from "react";
import {
  useGetVipPlans,
  useGetVipStatus,
  useGetVipPurchases,
  useSubmitVipPurchase,
  getGetVipStatusQueryKey,
  getGetVipPurchasesQueryKey,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import { Copy, Loader2, Crown, CheckCircle2 } from "lucide-react";

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function Vip() {
  const queryClient = useQueryClient();
  const { data: plansData, isLoading: loadingPlans } = useGetVipPlans();
  const { data: status } = useGetVipStatus({ query: { queryKey: getGetVipStatusQueryKey() } });
  const { data: purchases = [] } = useGetVipPurchases({ query: { queryKey: getGetVipPurchasesQueryKey() } });
  const submitPurchase = useSubmitVipPurchase();

  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [walletSent, setWalletSent] = useState("");
  const [txHash, setTxHash] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedPlan = plansData?.plans.find((p) => p.tier === selectedTier);

  const copyWallet = () => {
    if (!plansData?.walletAddress) return;
    navigator.clipboard.writeText(plansData.walletAddress);
    toast.success("Wallet address copied");
  };

  const openPlan = (tier: number) => {
    setSelectedTier(tier);
    setWalletSent("");
    setTxHash("");
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!selectedTier) return;
    if (!walletSent.trim() || !txHash.trim()) {
      toast.error("Please fill in both fields");
      return;
    }
    submitPurchase.mutate(
      { data: { tier: selectedTier, txHash: txHash.trim(), walletSent: walletSent.trim() } },
      {
        onSuccess: () => {
          setSubmitted(true);
          queryClient.invalidateQueries({ queryKey: getGetVipPurchasesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetVipStatusQueryKey() });
        },
        onError: () => toast.error("Failed to submit. Try again."),
      }
    );
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
      {/* Status banner */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {status?.active ? (
          <GameCard className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-amber-600 flex items-center gap-3">
            <Crown size={32} className="drop-shadow" />
            <div>
              <h2 className="font-display font-bold text-lg leading-none">VIP {["", "Bronze", "Silver", "Gold", "Diamond", "Platinum"][status.vipLevel] || `Tier ${status.vipLevel}`} Active</h2>
              {status.vipExpiresAt && (
                <p className="text-sm opacity-90">
                  Expires {new Date(status.vipExpiresAt).toLocaleDateString()}
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
          <motion.div key={plan.tier} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
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
          <h3 className="font-display font-bold text-muted-foreground uppercase text-xs tracking-wider px-2">History</h3>
          {purchases.map((p) => (
            <GameCard key={p.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-display font-bold text-sm">Tier {p.tier} · ${p.priceUsdt}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                {p.rejectReason && <p className="text-xs text-destructive mt-1">{p.rejectReason}</p>}
              </div>
              <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
            </GameCard>
          ))}
        </div>
      )}

      {/* Purchase modal */}
      <Dialog open={selectedTier !== null} onOpenChange={(open) => !open && setSelectedTier(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedPlan ? `${selectedPlan.emoji} ${selectedPlan.name} — $${selectedPlan.priceUsdt}` : ""}
            </DialogTitle>
            <DialogDescription>
              Send USDT ({plansData?.network}) to the address below, then submit your transaction hash for review.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="mx-auto text-primary" size={40} />
              <p className="font-display font-bold">Submitted for review</p>
              <p className="text-sm text-muted-foreground">Your VIP will activate within 24h once verified.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Send to ({plansData?.network})</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs break-all">{plansData?.walletAddress}</code>
                  <button onClick={copyWallet} className="shrink-0 p-1.5 rounded-lg hover:bg-background">
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-sm font-display font-bold mt-2">Amount: ${selectedPlan?.priceUsdt} USDT</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="walletSent">Your USDT wallet (sent from)</Label>
                <Input id="walletSent" value={walletSent} onChange={(e) => setWalletSent(e.target.value)} placeholder="T..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="txHash">Transaction Hash (TxID)</Label>
                <Input id="txHash" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." />
              </div>

              <GameButton className="w-full" onClick={handleSubmit} disabled={submitPurchase.isPending}>
                {submitPurchase.isPending ? <Loader2 className="animate-spin" size={16} /> : "Submit for Review"}
              </GameButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
