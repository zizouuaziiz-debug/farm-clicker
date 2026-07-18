import { useState } from "react";
import {
  useGetAdminStats,
  useGetAdminUsers,
  useUpdateAdminUser,
  useGetAdminWithdrawals,
  useApproveWithdrawal,
  useRejectWithdrawal,
  useGetAdminVipPurchases,
  useApproveVipPurchase,
  useRejectVipPurchase,
  useGetMe,
  getGetMeQueryKey,
  getGetAdminStatsQueryKey,
  getGetAdminUsersQueryKey,
  getGetAdminWithdrawalsQueryKey,
  getGetAdminVipPurchasesQueryKey,
  type GetAdminWithdrawalsStatus,
  type GetAdminVipPurchasesStatus,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GameCard, GameButton } from "@/components/ui/game-ui";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Ban, ShieldCheck, Check, X } from "lucide-react";

function truncate(v: string, n = 10) {
  if (!v || v.length <= n) return v;
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed" || status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function Admin() {
  const { data: me, isLoading: loadingMe } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  if (loadingMe) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center text-center gap-2 text-muted-foreground">
        <ShieldAlert size={40} />
        <p className="font-display font-bold text-lg">Access Denied</p>
        <p className="text-sm">This page is for admins only.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display font-bold text-xl flex items-center gap-2">
        <ShieldCheck className="text-primary" /> Admin Panel
      </h1>
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="withdrawals">Payouts</TabsTrigger>
          <TabsTrigger value="vip">VIP</TabsTrigger>
        </TabsList>

        <TabsContent value="stats"><StatsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
        <TabsContent value="vip"><VipTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatsTab() {
  const { data: stats, isLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!stats) return null;

  const cards = [
    { label: "Total Users", value: stats.totalUsers },
    { label: "Active Users", value: stats.activeUsers },
    { label: "Coins in Circulation", value: stats.totalCoinsInCirculation.toLocaleString() },
    { label: "Pending Withdrawals", value: stats.pendingWithdrawals },
    { label: "Pending VIP", value: stats.pendingVipPurchases },
    { label: "Completed Withdrawals", value: stats.totalWithdrawalsCompleted },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      {cards.map((c) => (
        <GameCard key={c.label} className="p-3">
          <p className="text-2xl font-display font-bold text-primary">{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </GameCard>
      ))}
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAdminUsers(undefined, { query: { queryKey: getGetAdminUsersQueryKey() } });
  const updateUser = useUpdateAdminUser();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });

  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-2 mt-3">
      {(data?.users || []).map((u) => (
        <GameCard key={u.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-sm">{u.username} <span className="text-muted-foreground font-normal">#{u.id}</span></p>
              <p className="text-xs text-muted-foreground">Lvl {u.level} · {u.coins.toLocaleString()} 🪙 · VIP {u.vipLevel}</p>
            </div>
            <div className="flex gap-1">
              {u.isAdmin && <Badge>Admin</Badge>}
              {u.isBanned && <Badge variant="destructive">Banned</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <GameButton
              size="sm"
              variant={u.isBanned ? "secondary" : "destructive"}
              className="flex-1"
              disabled={updateUser.isPending}
              onClick={() =>
                updateUser.mutate(
                  { id: u.id, data: { isBanned: !u.isBanned } },
                  { onSuccess: invalidate, onError: () => toast.error("Failed to update user") }
                )
              }
            >
              <Ban size={14} /> {u.isBanned ? "Unban" : "Ban"}
            </GameButton>
            {!u.isAdmin && (
              <GameButton
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={updateUser.isPending}
                onClick={() =>
                  updateUser.mutate(
                    { id: u.id, data: { isAdmin: true } },
                    { onSuccess: invalidate, onError: () => toast.error("Failed to update user") }
                  )
                }
              >
                Make Admin
              </GameButton>
            )}
          </div>
        </GameCard>
      ))}
    </div>
  );
}

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data: withdrawals = [], isLoading } = useGetAdminWithdrawals(
    filter ? { status: filter as GetAdminWithdrawalsStatus } : undefined,
    {
      query: {
        queryKey: getGetAdminWithdrawalsQueryKey(
          filter ? { status: filter as GetAdminWithdrawalsStatus } : undefined
        ),
      },
    }
  );
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() });

  const filters = ["all", "pending", "completed", "rejected"];

  return (
    <div className="space-y-3 mt-3">
      <div className="flex gap-1 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f === "all" ? undefined : f)}
            className={`px-3 py-1 rounded-full text-xs font-display font-bold ${
              (filter ?? "all") === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        withdrawals.map((w) => (
          <GameCard key={w.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-sm">{w.username} · {w.coinsAmount.toLocaleString()} 🪙 → ${w.usdtAmount}</p>
                <p className="text-xs text-muted-foreground">{truncate(w.usdtWallet)} · {new Date(w.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
            </div>
            {w.status === "pending" && (
              <div className="flex gap-2">
                <GameButton size="sm" className="flex-1" onClick={() => { setApproveId(w.id); setTxHash(""); }}>
                  <Check size={14} /> Approve
                </GameButton>
                <GameButton size="sm" variant="destructive" className="flex-1" onClick={() => { setRejectId(w.id); setReason(""); }}>
                  <X size={14} /> Reject
                </GameButton>
              </div>
            )}
          </GameCard>
        ))
      )}

      <Dialog open={approveId !== null} onOpenChange={(o) => !o && setApproveId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Approve Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="txh">Transaction Hash (optional)</Label>
            <Input id="txh" value={txHash} onChange={(e) => setTxHash(e.target.value)} />
            <GameButton
              className="w-full"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: approveId!, data: { txHash } },
                  { onSuccess: () => { invalidate(); setApproveId(null); }, onError: () => toast.error("Failed") }
                )
              }
            >
              Confirm Approve
            </GameButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Reject & Refund</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <GameButton
              className="w-full"
              variant="destructive"
              disabled={reject.isPending}
              onClick={() =>
                reject.mutate(
                  { id: rejectId!, data: { reason } },
                  { onSuccess: () => { invalidate(); setRejectId(null); }, onError: () => toast.error("Failed") }
                )
              }
            >
              Confirm Reject
            </GameButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VipTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data: purchases = [], isLoading } = useGetAdminVipPurchases(
    filter ? { status: filter as GetAdminVipPurchasesStatus } : undefined,
    {
      query: {
        queryKey: getGetAdminVipPurchasesQueryKey(
          filter ? { status: filter as GetAdminVipPurchasesStatus } : undefined
        ),
      },
    }
  );
  const approve = useApproveVipPurchase();
  const reject = useRejectVipPurchase();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetAdminVipPurchasesQueryKey() });

  const filters = ["all", "pending", "approved", "rejected"];

  return (
    <div className="space-y-3 mt-3">
      <div className="flex gap-1 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f === "all" ? undefined : f)}
            className={`px-3 py-1 rounded-full text-xs font-display font-bold ${
              (filter ?? "all") === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        purchases.map((p) => (
          <GameCard key={p.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-sm">{p.username} · Tier {p.tier} · ${p.priceUsdt}</p>
                <p className="text-xs text-muted-foreground">Tx: {truncate(p.txHash)} · From: {truncate(p.walletSent)}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
            </div>
            {p.status === "pending" && (
              <div className="flex gap-2">
                <GameButton
                  size="sm"
                  className="flex-1"
                  disabled={approve.isPending}
                  onClick={() =>
                    approve.mutate({ id: p.id }, { onSuccess: invalidate, onError: () => toast.error("Failed") })
                  }
                >
                  <Check size={14} /> Approve
                </GameButton>
                <GameButton size="sm" variant="destructive" className="flex-1" onClick={() => { setRejectId(p.id); setReason(""); }}>
                  <X size={14} /> Reject
                </GameButton>
              </div>
            )}
          </GameCard>
        ))
      )}

      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Reject VIP Purchase</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vreason">Reason</Label>
            <Input id="vreason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <GameButton
              className="w-full"
              variant="destructive"
              disabled={reject.isPending}
              onClick={() =>
                reject.mutate(
                  { id: rejectId!, data: { reason } },
                  { onSuccess: () => { invalidate(); setRejectId(null); }, onError: () => toast.error("Failed") }
                )
              }
            >
              Confirm Reject
            </GameButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
