import { useState } from "react";
import { useGetMyReferrals } from "@/api-client";
import { GameCard, GameButton } from "@/components/ui/game-ui";
import { Users, Copy, Check, Share2, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

export default function Invite() {
  const { data: referrals, isLoading } = useGetMyReferrals();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!referrals) return null;

  const shareText = "Come farm with me on Farm Clicker! 🌾";
  const shareUrl = referrals.shareLink;
  const copyValue = shareUrl ?? referrals.referralCode ?? "";

  const handleCopy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — try again.");
    }
  };

  const handleShare = () => {
    if (!shareUrl) {
      handleCopy();
      return;
    }
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
      .Telegram?.WebApp;
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(telegramShareUrl);
    } else {
      window.open(telegramShareUrl, "_blank");
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200">
          <Users size={24} />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl leading-none">Invite Friends</h1>
          <p className="text-muted-foreground text-sm">Earn coins for every friend who joins</p>
        </div>
      </div>

      <GameCard className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white border-indigo-500 p-5 text-center">
        <Gift size={36} className="mx-auto mb-2 drop-shadow-sm" />
        <p className="font-display font-bold text-lg">Share your link</p>
        <p className="text-sm opacity-90 mt-1">
          You get <span className="font-bold">+200 coins</span> and your friend gets{" "}
          <span className="font-bold">+100 coins</span> when they join.
        </p>
      </GameCard>

      <GameCard className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Your referral code</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-display font-bold text-lg text-center tracking-wider">
            {referrals.referralCode ?? "—"}
          </div>
          <GameButton variant="outline" size="lg" onClick={handleCopy} disabled={!copyValue}>
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </GameButton>
        </div>
        {!shareUrl && (
          <p className="text-xs text-muted-foreground italic">
            Share link isn't set up yet — send your friend this code and have them enter it when they join.
          </p>
        )}
        <GameButton variant="primary" size="lg" className="w-full" onClick={handleShare} disabled={!copyValue}>
          <Share2 size={18} />
          Share with Friends
        </GameButton>
      </GameCard>

      <GameCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Friends Invited</p>
            <p className="font-display font-bold text-2xl">{referrals.invitedCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Bonus Coins Earned</p>
            <p className="font-display font-bold text-2xl text-amber-600">
              {referrals.referralBonusCoinsEarned.toLocaleString()}
            </p>
          </div>
        </div>
      </GameCard>
    </div>
  );
}
