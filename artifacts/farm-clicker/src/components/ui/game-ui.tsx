import * as React from "react";
import { cn } from "@/lib/utils";
import { Coins, Star } from "lucide-react";

// ── GameCard ──────────────────────────────────────────────────────────────────
export type GameCardProps = React.HTMLAttributes<HTMLDivElement>;

export const GameCard = React.forwardRef<HTMLDivElement, GameCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground p-4 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
GameCard.displayName = "GameCard";

// ── GameButton ────────────────────────────────────────────────────────────────
export interface GameButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "ghost" | "destructive" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
}

export const GameButton = React.forwardRef<HTMLButtonElement, GameButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

    const variants: Record<string, string> = {
      default:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      primary:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
      accent: "bg-accent text-accent-foreground hover:bg-accent/80",
    };

    const sizes: Record<string, string> = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
GameButton.displayName = "GameButton";

// ── CoinDisplay ───────────────────────────────────────────────────────────────
export interface CoinDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  amount: number;
  size?: "sm" | "md" | "lg";
}

export function CoinDisplay({ amount, size = "md", className, ...props }: CoinDisplayProps) {
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 18 : 14;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-display font-bold text-amber-600",
        textSize,
        className,
      )}
      {...props}
    >
      <Coins size={iconSize} className="text-amber-500 shrink-0" />
      <span>{amount.toLocaleString()}</span>
    </div>
  );
}

// ── XpDisplay ─────────────────────────────────────────────────────────────────
export interface XpDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  xp: number;
  level: number;
  size?: "sm" | "md" | "lg";
}

export function XpDisplay({ xp, level, size = "sm", className, ...props }: XpDisplayProps) {
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const iconSize = size === "sm" ? 10 : size === "lg" ? 16 : 12;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 font-display font-bold text-blue-600",
        textSize,
        className,
      )}
      {...props}
    >
      <Star size={iconSize} className="text-blue-500 shrink-0 fill-blue-400" />
      <span>Lv.{level}</span>
      <span className="text-blue-400/70 font-normal ml-0.5">({xp.toLocaleString()} XP)</span>
    </div>
  );
}
