import { useMemo, useState } from "react";
import {
  useGetWithdrawInfo,
  useGetWithdrawHistory,
  useRequestWithdrawal,
  useGetMe,
  getGetMeQueryKey,
  getGetWithdrawHistoryQueryKey,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GameCard, GameButton, CoinDisplay } from "@/components/ui/game-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowDownToLine, AlertTriangle } from "lucide-react";

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Withdraw() {
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: info, isLoading: loadingInfo } = useGetWithdrawInfo();
  const { data: history = [] } = useGetWithdrawHistory({ query: { queryKey: getGetWithdrawHistoryQueryKey() } });
  const requestWithdrawal = useRequestWithdrawal();

  const [coinsAmount, setCoinsAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState<string>("TRC20");

  const networks = info?.networks ?? ["TRC20", "ERC20", "BEP20"];

  const coins = Number(coinsAmount) || 0;
  const usdtValue = useMemo(() => (info ? coins / info.coinsPerUsdt : 0), [coins, info]);
  const balance = user?.coins || 0;

  const belowMin = info ? coins > 0 && coins < info.minWithdrawalCoins : false;
  const overBalance = coins > balance;
  const canSubmit = coins > 0 && !belowMin && !overBalance && wallet.trim().length > 0 && !!network;

  const handleSubmit = () => {
    if (!canSubmit) return;
    requestWithdrawal.mutate(
      { data: { coinsAmount: coins, usdtWallet: wallet.trim(), network } },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Withdrawal requested");
          setCoinsAmount("");
          setWallet("");
        },
        onError: () => toast.error("Failed to submit withdrawal"),
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWithdrawHistoryQueryKey() });
        },
      }
    );
  };

  if (loadingInfo) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <GameCard className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Your balance</p>
            <CoinDisplay amount={balance} />
          </div>
          <div className="text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
            <p>Rate: {info?.coinsPerUsdt.toLocaleString()} coins = $1 USDT</p>
            <p>Minimum: {info?.minWithdrawalCoins.toLocaleString()} coins (${info?.minWithdrawalUsdt} USDT)</p>
            <p>Supported networks: {networks.join(", ")}</p>
          </div>
        </GameCard>
      </motion.div>

      <GameCard className="space-y-3">
        <h3 className="font-display font-bold flex items-center gap-2">
          <ArrowDownToLine size={18} className="text-primary" /> Request Withdrawal
        </h3>

        <div className="space-y-1">
          <Label htmlFor="coinsAmount">Coins to withdraw</Label>
          <Input
            id="coinsAmount"
            type="number"
            inputMode="numeric"
            value={coinsAmount}
            onChange={(e) => setCoinsAmount(e.target.value)}
            placeholder="e.g. 5000"
          />
          <p className="text-xs text-muted-foreground">≈ ${usdtValue.toFixed(2)} USDT</p>
          {belowMin && <p className="text-xs text-destructive">Below minimum withdrawal amount</p>}
          {overBalance && <p className="text-xs text-destructive">Exceeds your coin balance</p>}
        </div>

        <div className="space-y-1">
          <Label>Network</Label>
          <div className="flex gap-2 flex-wrap">
            {networks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  network === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="wallet">Your USDT wallet ({network})</Label>
          <Input id="wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder={network === "TRC20" ? "T..." : "0x..."} />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <p>Coins are deducted immediately and refunded automatically if your request is rejected.</p>
        </div>

        <GameButton className="w-full" disabled={!canSubmit || requestWithdrawal.isPending} onClick={handleSubmit}>
          {requestWithdrawal.isPending ? <Loader2 className="animate-spin" size={16} /> : `Request Withdrawal via ${network}`}
        </GameButton>
      </GameCard>

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display font-bold text-muted-foreground uppercase text-xs tracking-wider px-2">History</h3>
          {history.map((w) => (
            <GameCard key={w.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-display font-bold text-sm">{w.coinsAmount.toLocaleString()} 🪙 → ${w.usdtAmount}</p>
                <p className="text-xs text-muted-foreground">{truncate(w.usdtWallet)} · {new Date(w.createdAt).toLocaleDateString()}</p>
                {w.rejectReason && <p className="text-xs text-destructive mt-1">{w.rejectReason}</p>}
              </div>
              <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
            </GameCard>
          ))}
        </div>
      )}
    </div>
  );
}
