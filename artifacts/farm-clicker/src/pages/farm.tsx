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

  const hasReady = plots.some(p => p.state === "ready");
  const hasThirsty = plots.some(p => p.state === "needs_water");

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePlotClick = (plot: FarmPlot) => {
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
          disabled={!hasThirsty || waterAll.isPending}
          onClick={handleWaterAll}
        >
          <Droplets size={16} /> Water All
        </GameButton>
        <GameButton
          variant="primary"
          size="sm"
          disabled={!hasReady || harvestAll.isPending}
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
                            onClick={() => handlePlant(type)}
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

function PlotCard({ plot, onClick }: { plot: FarmPlot; onClick: () => void }) {
  let secondsLeft = 0;
  if (plot.readyAt && plot.state === "growing") {
    secondsLeft = Math.max(0, Math.floor((new Date(plot.readyAt).getTime() - Date.now()) / 1000));
  }

  const renderContent = () => {
    switch (plot.state) {
      case "empty":
        return <div className="text-white/30"><Plus size={24} /></div>;
      case "growing":
        return (
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl filter drop-shadow-md mb-1 animate-pulse">{CROP_EMOJIS[plot.cropType!] || "🌱"}</span>
            <div className="bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
              {formatTime(secondsLeft)}
            </div>
            <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45" fill="none" stroke="#4ade80" strokeWidth="6"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * (plot.growthPercent || 0) / 100)}
                className="transition-all duration-1000"
              />
            </svg>
          </div>
        );
      case "needs_water":
        return (
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl filter drop-shadow-md mb-1 opacity-80">{CROP_EMOJIS[plot.cropType!] || "🌱"}</span>
            <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 animate-bounce border-2 border-white shadow-sm z-10">
              <Droplets size={16} className="text-white" />
            </div>
          </div>
        );
      case "ready":
        return (
          <div className="flex flex-col items-center justify-center">
            <span className="text-4xl filter drop-shadow-lg animate-bounce">{CROP_EMOJIS[plot.cropType!] || "🌱"}</span>
            <div className="absolute -top-1 -right-1 text-yellow-400 animate-spin">
              <Sparkles size={20} fill="currentColor" />
            </div>
          </div>
        );
      case "withered":
      case "dead":
        return (
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-2xl grayscale opacity-60">🥀</span>
            <div className="flex items-center gap-0.5 bg-black/40 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              <Trash2 size={9} /> Clear
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const bgs: Record<string, string> = {
    empty: "bg-[#7A5230]",
    growing: "bg-[#654321]",
    needs_water: "bg-[#8B6B4A]",
    ready: "bg-[#4a3728] border-yellow-400 border-2",
    withered: "bg-gray-700",
    dead: "bg-gray-800",
    planted: "bg-[#654321]"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`relative w-full h-full rounded-2xl flex items-center justify-center transition-colors shadow-inner overflow-hidden ${bgs[plot.state] || "bg-[#7A5230]"}`}
      style={{ boxShadow: "inset 0 4px 6px -1px rgba(0,0,0,0.3), inset 0 2px 4px -1px rgba(0,0,0,0.06)" }}
    >
      {renderContent()}
    </motion.button>
  );
}
