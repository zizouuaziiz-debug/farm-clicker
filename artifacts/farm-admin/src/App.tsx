import { lazy, Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Route, Switch, useLocation } from "wouter";
import { Toaster } from "sonner";
import { initAdminAuth, getAdminToken, clearAdminToken } from "@/lib/admin-auth";
import { Loader2 } from "lucide-react";

// Lazy-load admin pages — they're heavy (tables, charts, forms)
const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Users = lazy(() => import("@/pages/users"));
const Withdrawals = lazy(() => import("@/pages/withdrawals"));
const Deposits = lazy(() => import("@/pages/deposits"));
const VipPurchases = lazy(() => import("@/pages/vip-purchases"));
const GameManagement = lazy(() => import("@/pages/game-management"));
const Logs = lazy(() => import("@/pages/logs"));
const NotFound = lazy(() => import("@/pages/not-found"));

initAdminAuth();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      gcTime: 3 * 60_000,
    },
  },
});

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", emoji: "📊", exact: true },
  { path: "/users", label: "Users", emoji: "👥", exact: false },
  { path: "/withdrawals", label: "Withdrawals", emoji: "💸", exact: false },
  { path: "/deposits", label: "Deposits", emoji: "💳", exact: false },
  { path: "/vip-purchases", label: "VIP Requests", emoji: "💎", exact: false },
  { path: "/game-management", label: "Game Economy", emoji: "🎮", exact: false },
  { path: "/logs", label: "Logs", emoji: "📋", exact: false },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [location, navigate] = useLocation();
  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <div>
            <div className="font-bold text-gray-900 text-sm">Farm Admin</div>
            <div className="text-xs text-gray-400">Management Panel</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? location === "/" : location.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  );
}

function AdminLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/users" component={Users} />
            <Route path="/withdrawals" component={Withdrawals} />
            <Route path="/deposits" component={Deposits} />
            <Route path="/vip-purchases" component={VipPurchases} />
            <Route path="/game-management" component={GameManagement} />
            <Route path="/logs" component={Logs} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(!!getAdminToken());

  function handleLogin() {
    setAuthed(true);
    queryClient.clear();
  }

  function handleLogout() {
    clearAdminToken();
    queryClient.clear();
    setAuthed(false);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {authed ? (
          <AdminLayout onLogout={handleLogout} />
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Login onLogin={handleLogin} />
          </Suspense>
        )}
      </WouterRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
