import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/Layout";
import { Splash } from "@/pages/Splash";
import { Home } from "@/pages/Home";
import { ChartScreen } from "@/pages/ChartScreen";
import { Signals } from "@/pages/Signals";
import { Portfolio } from "@/pages/Portfolio";
import { Settings } from "@/pages/Settings";
import { StrategyScreen } from "@/pages/StrategyScreen";
import { ScannerScreen } from "@/pages/ScannerScreen";
import { PaperTrading } from "@/pages/PaperTrading";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Splash} />
        <Route path="/home" component={Home} />
        <Route path="/charts" component={ChartScreen} />
        <Route path="/signals" component={Signals} />
        <Route path="/strategies" component={StrategyScreen} />
        <Route path="/scanner" component={ScannerScreen} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/account" component={Portfolio} />
        <Route path="/settings" component={Settings} />
        <Route path="/paper" component={PaperTrading} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
