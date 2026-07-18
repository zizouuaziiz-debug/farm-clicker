import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background w-full flex flex-col relative max-w-md mx-auto border-x border-border shadow-2xl overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
      <TopBar />
      <main className="flex-1 overflow-y-auto pt-[72px] pb-[80px] scroll-smooth">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
