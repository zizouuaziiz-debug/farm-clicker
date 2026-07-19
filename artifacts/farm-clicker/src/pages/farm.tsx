import { useQueryClient } from "@tanstack/react-query";
import {
  useGetFarmPlots,
  useHarvestPlot,
  useWaterPlot,
  useHarvestAll,
  useWaterAll,
  usePlantSeed,
  useGetInventory,
  getGetFarmPlotsQueryKey,
  getGetInventoryQueryKey,
  getGetMeQueryKey,
  type FarmPlot,
  type PlantInputCropType,
} from "@/api-client";
import { GameButton, GameCard } from "@/components/ui/game-ui";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Sparkles, Loader2, X, Plus, Trash2 } from "lucide-react";
import { formatTime } from "@/lib/utils";

const CROP_EMOJIS: Record<string, string> = {
  wheat: "🌾",
  sunflower: "🌻",
  tomato: "🍅",
  carrot: "🥕",
  potato: "🥔",
  corn: "🌽",
};

export default function Farm() {
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const { data: plots = [], isLoading } = useGetFarmPlots({
    query: { refetchInterval: 5000, queryKey: getGetFarmPlotsQueryKey() }
  });

  const { data: inventory = [] } = useGetInventory({
    query: { queryKey: getGetInventoryQueryKey() }
  });

  const harvestPlot = useHarvestPlot();
  const waterPlot = useWaterPlot();
  const plantSeed = usePlantSeed();
  const harvestAll = useHarvestAll();
  const waterAll = useWaterAll();
  const isBusy =
  harvestPlot.isPending ||
  waterPlot.isPending ||
  plantSeed.isPending ||
  harvestAll.isPending ||
  waterAll.isPending;

  const hasReady = plots.some(p => p.state === "ready");
  const hasThirsty = plots.some(p => p.state === "needs_water");

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePlotClick = (plot: FarmPlot) => {
    if (isBusy) return;
    if (plot.state === "empty") {
      setSelectedSlot(plot.slot);
    } else if (plot.state === "ready") {
      harvestPlot.mutate({ plotId: plot.id }, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
          queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
          toast.success(`Harvested ${data.quantity} ${CROP_EMOJIS[data.cropType] ?? "🌱"}! +${data.coinsEarned}🪙`);
        },
        onError: () => toast.error("Failed to harvest")
      });
    } else if (plot.state === "needs_water") {
      waterPlot.mutate({ plotId: plot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
          toast.success("Plot watered! 💧");
        },
        onError: () => toast.error("Failed to water")
      });
    } else if (plot.state === "withered" || plot.state === "dead") {
      harvestPlot.mutate({ plotId: plot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
          toast("Cleared plot 🗑️");
        }
      });
    }
  };

  const handlePlant = (cropType: string) => {
    if (selectedSlot === null) return;
    plantSeed.mutate({ data: { slot: selectedSlot, cropType: cropType as PlantInputCropType } }, {
      onSuccess: () => {
        setSelectedSlot(null);
        queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err) => toast.error(err?.message || "Failed to plant")
    });
  };

  const handleHarvestAll = () => {
    harvestAll.mutate(undefined, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
        queryClient.setQueryData(getGetMeQueryKey(), data.user);
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        toast.success(`Harvested ${data.harvested} plots! +${data.totalCoins}🪙`);
      }
    });
  };

  const handleWaterAll = () => {
    waterAll.mutate(undefined, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetFarmPlotsQueryKey() });
        toast.success(`Watered ${data.watered} plots! 💧`);
      }
    });
  };

  const gridPlots = Array(9).fill(null).map((_, i) => {
    return plots.find(p => p.slot === i) || { slot: i, id: -1, state: "empty" };
  });

  const availableSeeds = inventory.filter(i => i.itemType.endsWith("_seed") && i.quantity > 0);

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">

      <div className="flex gap-2 justify-end">
        <GameButton
          variant="secondary"
          size="sm"
          disabled={!hasThirsty || isBusy}
          onClick={handleWaterAll}
        >
          <Droplets size={16} /> Water All
        </GameButton>
        <GameButton
          variant="primary"
          size="sm"
          disabled={!hasReady || isBusy}
          onClick={handleHarvestAll}
        >
          <Sparkles size={16} /> Harvest All
        </GameButton>
      </div>

      <div className="grid grid-cols-3 gap-3 aspect-square bg-[#8B5A2B]/20 p-4 rounded-3xl border-4 border-[#654321]/30">
        {gridPlots.map((plot) => (
          <PlotCard
            key={plot.slot}
            plot={plot as FarmPlot}
            onClick={() => handlePlotClick(plot as FarmPlot)}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Tap empty plots to plant • Tap ready crops to harvest
      </p>

      <AnimatePresence>
        {selectedSlot !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setSelectedSlot(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[340px] max-w-[90vw]"
            >
              <div className="bg-card rounded-2xl border border-border shadow-2xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-display font-bold text-lg">Plant Seed</h2>
                  <button 
                    onClick={() => setSelectedSlot(null)} 
                    className="p-1.5 bg-muted rounded-full text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {availableSeeds.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">You don't have any seeds.</p>
                    <GameButton onClick={() => window.location.href = "/shop"}>Go to Shop</GameButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableSeeds.map((seed) => {
                      const type = seed.itemType.replace("_seed", "");
                      return (
                        <div
                          key={seed.id}
                          className="bg-muted/30 rounded-xl p-3 flex flex-col items-center text-center border border-border/50 hover:border-primary/40 hover:bg-muted/50 transition-all"
                        >
                          <div className="text-3xl mb-1">
                            {CROP_EMOJIS[type] || "🌱"}
                          </div>
                          <p className="font-display font-bold capitalize text-sm leading-tight">{type}</p>
                          <p className="text-xs text-muted-foreground mb-2">x{seed.quantity}</p>
                          <GameButton
                            size="sm"
                            className="w-full text-xs py-1.5 h-auto"
                            onClick={() => !isBusy && handlePlant(type)}
                          >
                            Plant
                          </GameButton>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
function getCropStage(crop: string | undefined, progress: number) {
  if (!crop) return "🌱";

  if (progress < 25) return "🌰";
  if (progress < 55) return "🌱";
  if (progress < 90) return CROP_EMOJIS[crop] || "🌿";

  return CROP_EMOJIS[crop] || "🌾";
}
function PlotCard({ plot, onClick }: { plot: FarmPlot; onClick: () => void }) {

  const [smoothProgress, setSmoothProgress] = useState(
    plot.growthPercent || 0
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSmoothProgress(prev => {
        const target = plot.growthPercent || 0;

        if (Math.abs(prev - target) < 0.5) {
          return target;
        }

        return prev + (target - prev) * 0.08;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [plot.growthPercent]);


  let secondsLeft = 0;

  if (plot.readyAt && plot.state === "growing") {
    secondsLeft = Math.max(
      0,
      Math.floor(
        (new Date(plot.readyAt).getTime() - Date.now()) / 1000
      )
    );
  }


  const progressOffset =
    283 - (283 * smoothProgress / 100);



  const renderContent = () => {

    switch (plot.state) {

      case "empty":
        return (
          <div className="text-white/40">
            <Plus size={26}/>
          </div>
        );


      case "growing":
        return (
          <div className="relative flex flex-col items-center justify-center w-full h-full">

            <span
              className="
              text-4xl
              z-10
              animate-pulse
              drop-shadow-[0_6px_5px_rgba(0,0,0,0.6)]
              "
            >
              {getCropStage(
                plot.cropType,
                smoothProgress
              )}
            </span>


            <div
              className="
              bg-black/60
              text-white
              text-[10px]
              font-bold
              px-2
              py-1
              rounded-full
              z-10
              "
            >
              {formatTime(secondsLeft)}
            </div>


            <svg
              className="
              absolute
              inset-2
              w-[calc(100%-16px)]
              h-[calc(100%-16px)]
              -rotate-90
              "
              viewBox="0 0 100 100"
            >

              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,.2)"
                strokeWidth="7"
              />


              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#4ade80"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={progressOffset}
              />

            </svg>

          </div>
        );


      case "needs_water":
        return (
          <div className="relative">

            <span
              className="
              text-4xl
              opacity-80
              drop-shadow-[0_5px_5px_rgba(0,0,0,.5)]
              "
            >
              {getCropStage(
                plot.cropType,
                plot.growthPercent || 50
              )}
            </span>


            <div
              className="
              absolute
              -top-2
              -right-2
              bg-blue-500
              rounded-full
              p-1
              animate-bounce
              border-2
              border-white
              "
            >
              <Droplets size={16}/>
            </div>

          </div>
        );


      case "ready":
        return (
          <motion.div
            animate={{ y:[0,-8,0] }}
            transition={{
              repeat:Infinity,
              duration:1.2
            }}
            className="relative"
          >

            <span
              className="
              text-5xl
              drop-shadow-[0_8px_6px_rgba(0,0,0,.6)]
              "
            >
              {CROP_EMOJIS[plot.cropType!] || "🌾"}
            </span>


            <Sparkles
              size={22}
              fill="currentColor"
              className="
              absolute
              -top-3
              -right-3
              text-yellow-300
              animate-spin
              "
            />

          </motion.div>
        );


      case "withered":
      case "dead":
        return (
          <div className="flex flex-col items-center">

            <span className="text-3xl grayscale opacity-60">
              🥀
            </span>

            <span className="
              bg-black/50
              text-white
              text-[10px]
              px-2
              py-1
              rounded-full
            ">
              <Trash2 size={10} className="inline"/>
              Clear
            </span>

          </div>
        );


      default:
        return null;
    }
  };



  const bgs: Record<string,string> = {

    empty:
      "bg-[#8b5a2b]",

    growing:
      "bg-[#654321]",

    needs_water:
      "bg-[#806044]",

    ready:
      "bg-[#4a3728] border-2 border-yellow-400",

    withered:
      "bg-gray-700",

    dead:
      "bg-gray-800",

    planted:
      "bg-[#654321]"
  };


  return (

    <motion.button

      whileTap={{scale:.92}}

      whileHover={{
        scale:1.03,
        y:-3
      }}

      onClick={onClick}

      className={`
      relative
      w-full
      h-full
      rounded-2xl
      flex
      items-center
      justify-center
      overflow-hidden
      transition-all

      ${bgs[plot.state] || bgs.empty}

      shadow-[inset_0_-10px_15px_rgba(0,0,0,.35),
      inset_0_5px_10px_rgba(255,255,255,.15),
      0_8px_15px_rgba(0,0,0,.35)]

      border
      border-white/10
      `}
    >

      {renderContent()}

    </motion.button>
  );
}
