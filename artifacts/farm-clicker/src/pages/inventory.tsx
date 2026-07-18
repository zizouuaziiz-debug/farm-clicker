import { useGetInventory, getGetInventoryQueryKey } from "@/api-client";
import { GameCard } from "@/components/ui/game-ui";
import { Loader2 } from "lucide-react";

export default function Inventory() {
  const { data: inventory = [], isLoading } = useGetInventory({
    query: { queryKey: getGetInventoryQueryKey() }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const items = inventory.filter(i => i.quantity > 0);

  // Emojis mapping based on names
  const getEmoji = (type: string) => {
    if (type.includes("wheat")) return "🌾";
    if (type.includes("tomato")) return "🍅";
    if (type.includes("potato")) return "🥔";
    return "📦";
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-display font-bold text-2xl mb-4">Backpack</h1>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <span className="text-6xl block mb-4 opacity-30">🎒</span>
          <p>Your bag is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map(item => (
            <GameCard key={item.id} className="flex flex-col items-center justify-center p-3 aspect-square text-center">
              <div className="text-4xl mb-2 filter drop-shadow-sm">
                {getEmoji(item.itemType)}
              </div>
              <div className="font-bold text-xs uppercase tracking-wider mb-1 line-clamp-1 truncate w-full">
                {item.itemType.replace("_", " ")}
              </div>
              <div className="bg-primary/10 text-primary font-bold text-xs px-2 py-0.5 rounded-md">
                x{item.quantity}
              </div>
            </GameCard>
          ))}
        </div>
      )}
    </div>
  );
}
