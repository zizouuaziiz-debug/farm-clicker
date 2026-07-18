import { useLocation } from "wouter";
import { Link } from "wouter";
import { Home, Sprout, Store, Backpack, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/farm", icon: Sprout, label: "Farm" },
  { path: "/shop", icon: Store, label: "Shop" },
  { path: "/inventory", icon: Backpack, label: "Bag" },
  { path: "/leaderboard", icon: Trophy, label: "Rank" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-2 border-border pb-safe">
      <div className="max-w-md mx-auto px-2 py-2 flex items-center justify-between">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path} className="relative flex flex-col items-center p-2 w-16 select-none">
              <div className={cn(
                "relative z-10 flex flex-col items-center transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={cn("mb-1", isActive && "animate-bounce")} />
                <span className="text-[10px] font-display font-semibold">{item.label}</span>
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary/10 rounded-2xl"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
