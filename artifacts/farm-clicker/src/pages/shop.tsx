import {
  useGetShopSeeds,
  useGetInventory,
  useBuySeeds,
  useSellItems,
  getGetShopSeedsQueryKey,
  getGetInventoryQueryKey,
  getGetMeQueryKey,
  useGetMe,
  useGetAdsStatus,
  getGetAdsStatusQueryKey
} from "@/api-client";

import { useState } from "react";
import { GameCard, GameButton, CoinDisplay } from "@/components/ui/game-ui";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Loader2, PlayCircle, Plus, Minus } from "lucide-react";
import { useRewardedAd } from "@/hooks/use-rewarded-ad";

export default function Shop() {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});

  const queryClient = useQueryClient();

  const { data: user } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey()
    }
  });

  const { data: seeds = [], isLoading: isLoadingSeeds } = useGetShopSeeds({
    query: {
      queryKey: getGetShopSeedsQueryKey()
    }
  });

  const { data: inventory = [], isLoading: isLoadingInv } = useGetInventory({
    query: {
      queryKey: getGetInventoryQueryKey()
    }
  });

  const { data: adsStatus } = useGetAdsStatus({
    query: {
      queryKey: getGetAdsStatusQueryKey()
    }
  });

  const buySeed = useBuySeeds();
  const sellCrops = useSellItems();
  const bonusAd = useRewardedAd("bonus");

  const getQty = (cropType: string) =>
    buyQty[cropType] ?? 1;


  const setQty = (cropType: string, qty: number) =>
    setBuyQty(prev => ({
      ...prev,
      [cropType]: Math.max(1, Math.min(99, qty))
    }));


  const handleWatchAdForCoins = async () => {
    try {
      const data = await bonusAd.watch();
      toast.success(`+${data.reward.coins} coins from ad! 🪙`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't watch ad. Try again soon.");
    }
  };


  const handleBuy = (
    cropType: string,
    costEach: number
  ) => {

    const qty = getQty(cropType);
    const total = costEach * qty;

    if ((user?.coins || 0) < total) {
      toast.error(
        "Not enough coins!"
      );
      return;
    }


    buySeed.mutate(
      {
        data: {
          cropType,
          quantity: qty
        }
      },
      {
        onSuccess: (data) => {

          toast.success(
            `Bought ${qty} ${cropType} seed${qty > 1 ? "s" : ""}!`
          );


          queryClient.setQueryData(
            getGetMeQueryKey(),
            data.user
          );


          queryClient.invalidateQueries({
            queryKey: getGetInventoryQueryKey()
          });
        }
      }
    );
  };


  const handleSell = (
    itemType: string,
    qty: number
  ) => {

    sellCrops.mutate(
      {
        data: {
          itemType,
          quantity: qty
        }
      },
      {
        onSuccess: (data) => {

          toast.success(
            `Sold ${qty} for +${data.totalCoins}🪙`
          );


          queryClient.setQueryData(
            getGetMeQueryKey(),
            data.user
          );


          queryClient.invalidateQueries({
            queryKey: getGetInventoryQueryKey()
          });
        },


        onError: () =>
          toast.error(
            "Failed to sell"
          )
      }
    );
  };


  if (isLoadingSeeds || isLoadingInv) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }


  const harvestedCrops = inventory.filter(
    i =>
      !i.itemType.endsWith("_seed") &&
      i.quantity > 0
  );  return (
    <div className="p-4 space-y-6">

      {/* Tabs */}
      <div className="flex p-1 bg-muted rounded-2xl">

        <button
          className={`flex-1 py-2 rounded-xl font-display font-bold text-sm transition-all ${
            tab === "buy"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground"
          }`}
          onClick={() => setTab("buy")}
        >
          Buy Seeds
        </button>


        <button
          className={`flex-1 py-2 rounded-xl font-display font-bold text-sm transition-all ${
            tab === "sell"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground"
          }`}
          onClick={() => setTab("sell")}
        >
          Sell Crops
        </button>

      </div>


      {adsStatus?.bonusAd.available && (
        <button
          onClick={handleWatchAdForCoins}
          disabled={bonusAd.isBusy}
          className="w-full h-12 rounded-xl bg-amber-500 text-white font-display font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          <PlayCircle size={18} />
          Watch Ad for Free Coins
        </button>
      )}



      {tab === "buy" && (
        <div className="space-y-4">

          {seeds.map(seed => {

            const isLocked =
              (user?.level || 1) < seed.requiredLevel;

            const qty =
              getQty(seed.cropType);

            const totalCost =
              seed.buyCost * qty;

            const canAfford =
              (user?.coins || 0) >= totalCost;


            return (

              <GameCard
                key={seed.cropType}
                className={`p-4 ${
                  isLocked
                    ? "opacity-60 grayscale-[0.5]"
                    : ""
                }`}
              >

                <div className="flex items-start gap-4">

                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-4xl border border-border shrink-0">
                    {seed.emoji}
                  </div>


                  <div className="flex-1">

                    <div className="flex items-center justify-between mb-1">

                      <h3 className="font-display font-bold text-lg leading-none">
                        {seed.name} Seed
                      </h3>


                      <CoinDisplay
                        amount={seed.buyCost}
                        className="text-sm py-0.5 px-2 bg-transparent border-0"
                      />

                    </div>


                    <div className="flex gap-3 text-xs text-muted-foreground font-medium mb-3">

                      <span>
                        ⏱️ {Math.floor(seed.growTime / 60000)}m
                      </span>

                      <span>
                        💧 ×{seed.waterNeeded}
                      </span>

                      <span>
                        💰 {seed.sellPrice}
                      </span>

                    </div>



                    {isLocked ? (

                      <div className="flex items-center justify-center gap-2 bg-muted text-muted-foreground py-2 rounded-xl text-sm font-bold">

                        <Lock size={14} />

                        Unlocks at Lvl {seed.requiredLevel}

                      </div>


                    ) : (

                      <div className="flex items-center gap-2">


                        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 border border-border">

                          <button
                            onClick={() =>
                              setQty(
                                seed.cropType,
                                qty - 1
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-background flex items-center justify-center active:scale-90 transition-transform"
                          >
                            <Minus size={14}/>
                          </button>


                          <span className="w-8 text-center font-display font-bold text-sm">
                            {qty}
                          </span>


                          <button
                            onClick={() =>
                              setQty(
                                seed.cropType,
                                qty + 1
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-background flex items-center justify-center active:scale-90 transition-transform"
                          >
                            <Plus size={14}/>
                          </button>


                        </div>



                        <GameButton
                          className="flex-1"
                          size="sm"
                          disabled={
                            buySeed.isPending ||
                            !canAfford
                          }
                          onClick={() =>
                            handleBuy(
                              seed.cropType,
                              seed.buyCost
                            )
                          }
                        >

                          {
                            canAfford
                              ? `Buy ${qty} · ${totalCost}🪙`
                              : `Need ${totalCost}🪙`
                          }

                        </GameButton>


                      </div>

                    )}

                  </div>

                </div>


              </GameCard>

            );

          })}

        </div>
      )}




      {tab === "sell" && (

        <div className="space-y-4">


          {harvestedCrops.length === 0 ? (

            <div className="text-center py-12 text-muted-foreground">

              <span className="text-4xl block mb-2 opacity-50">
                🧺
              </span>

              <p>
                Nothing to sell.
              </p>

              <p className="text-sm">
                Harvest crops first!
              </p>

            </div>


          ) : (


            harvestedCrops.map(item => {

              const seedInfo =
                seeds.find(
                  s =>
                    s.cropType === item.itemType
                );


              const sellPrice =
                seedInfo?.sellPrice || 5;


              const totalValue =
                sellPrice * item.quantity;



              return (

                <GameCard
                  key={item.id}
                  className="flex items-center justify-between p-4"
                >


                  <div className="flex items-center gap-3">


                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-3xl border border-border">

                      {seedInfo?.emoji || "📦"}

                    </div>


                    <div>

                      <h3 className="font-display font-bold capitalize text-lg leading-tight">

                        {item.itemType}

                      </h3>


                      <p className="text-sm text-muted-foreground">

                        ×{item.quantity} · {sellPrice}🪙 each

                      </p>

                    </div>


                  </div>



                  <div className="flex flex-col gap-1.5">


                    <GameButton
                      variant="secondary"
                      size="sm"
                      disabled={sellCrops.isPending}
                      onClick={() =>
                        handleSell(
                          item.itemType,
                          1
                        )
                      }
                    >

                      Sell 1

                    </GameButton>



                    {item.quantity > 1 && (

                      <GameButton
                        variant="primary"
                        size="sm"
                        disabled={sellCrops.isPending}
                        onClick={() =>
                          handleSell(
                            item.itemType,
                            item.quantity
                          )
                        }
                      >

                        Sell All +{totalValue}🪙

                      </GameButton>

                    )}


                  </div>


                </GameCard>

              );

            })


          )}


        </div>

      )}


    </div>
  );
}
  
