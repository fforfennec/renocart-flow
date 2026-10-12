import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import NotFound from "./pages/NotFound";
import Index from "./portals/client/pages/Index";
import Commander from "./portals/client/pages/Commander";
import Projets from "./portals/client/pages/Projets";
import ResetPassword from "./portals/client/pages/ResetPassword";

// Second portal: loaded on demand so client visitors never download it.
const TeamRoutes = lazy(() => import("./portals/team/TeamRoutes"));
const team = <Suspense fallback={<div className="min-h-screen bg-background" />}><TeamRoutes /></Suspense>;

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/commander" element={<Commander />} />
            <Route path="/projets" element={<Projets />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {["/equipe/*", "/admin/*", "/supplier/*"].map((p) => <Route key={p} path={p} element={team} />)}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
