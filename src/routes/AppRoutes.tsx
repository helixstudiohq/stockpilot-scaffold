import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Forecasting from "@/pages/Forecasting";
import Orders from "@/pages/Orders";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Stores from "@/pages/Stores";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import { Route, Routes } from "react-router";
import type { ReactNode } from "react";

function Protected({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

/** Central route table. Authenticated product areas live under AppShell. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
      <Route path="/forecasting" element={<Protected><Forecasting /></Protected>} />
      <Route path="/orders" element={<Protected><Orders /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/stores" element={<Protected><Stores /></Protected>} />
      <Route path="/stores/:storeId" element={<Protected><Stores /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
