import { lazy, Suspense } from "react";
import { AuthProvider } from "./components/auth-provider";
import { Layout } from "./components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";

// Lazy-load all page components — reduces initial bundle size
const Home = lazy(() => import("./pages/home"));
const Farm = lazy(() => import("./pages/farm"));
const Shop = lazy(() => import("./pages/shop"));
const Inventory = lazy(() => import("./pages/inventory"));
const Leaderboard = lazy(() => import("./pages/leaderboard"));
const Daily = lazy(() => import("./pages/daily"));
const Missions = lazy(() => import("./pages/missions"));
const Achievements = lazy(() => import("./pages/achievements"));
const Stats = lazy(() => import("./pages/stats"));
const Vip = lazy(() => import("./pages/vip"));
const Withdraw = lazy(() => import("./pages/withdraw"));
const Invite = lazy(() => import("./pages/invite"));
const Admin = lazy(() => import("./pages/admin"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/farm" component={Farm} />
          <Route path="/shop" component={Shop} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/daily" component={Daily} />
          <Route path="/missions" component={Missions} />
          <Route path="/achievements" component={Achievements} />
          <Route path="/stats" component={Stats} />
          <Route path="/vip" component={Vip} />
          <Route path="/withdraw" component={Withdraw} />
          <Route path="/invite" component={Invite} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" theme="light" className="font-display" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
