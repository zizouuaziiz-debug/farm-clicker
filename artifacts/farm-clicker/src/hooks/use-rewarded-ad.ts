import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adsService } from "@/lib/ads-service";
import {
  useRequestAdTicket,
  useClaimAdReward,
  getGetMeQueryKey,
  getGetAdsStatusQueryKey,
  type AdPlacement,
  type AdRewardResult,
} from "@/api-client";

export type RewardedAdStatus = "idle" | "loading" | "playing" | "claiming";

/**
 * Full server-verified rewarded-ad flow for one placement:
 *   1. Ask the server for eligibility + a single-use ticket (`/ads/ticket`).
 *   2. Play the ad via the Adsgram SDK.
 *   3. Redeem the ticket for the reward (`/ads/claim`) — only reachable if
 *      the ad actually finished, and only once per ticket.
 *
 * This is the *only* way any ad placement in the app grants a reward; there
 * is no direct "just give me the reward" endpoint.
 */
export function useRewardedAd(placement: AdPlacement) {
  const [status, setStatus] = useState<RewardedAdStatus>("idle");
  const requestTicket = useRequestAdTicket();
  const claimReward = useClaimAdReward();
  const queryClient = useQueryClient();

  const watch = useCallback(async (): Promise<AdRewardResult> => {
    setStatus("loading");
    try {
      const { token } = await requestTicket.mutateAsync({ data: { placement } });

      setStatus("playing");
      await adsService.showRewarded();

      setStatus("claiming");
      const result = await claimReward.mutateAsync({ data: { token } });

      queryClient.setQueryData(getGetMeQueryKey(), result.user);
      queryClient.invalidateQueries({ queryKey: getGetAdsStatusQueryKey() });

      return result;
    } finally {
      setStatus("idle");
    }
  }, [placement, requestTicket, claimReward, queryClient]);

  return {
    watch,
    status,
    isBusy: status !== "idle",
    isSdkAvailable: adsService.isSdkLoaded(),
  };
}
