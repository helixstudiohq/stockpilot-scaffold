import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useStores } from "@/hooks/use-dashboard";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Store as StoreIcon,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { toast } from "sonner";

const NAV_MAIN = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inventory", icon: PackageSearchIcon, label: "Inventory" },
  { to: "/forecasting", icon: LineChart, label: "Forecasting" },
  { to: "/orders", icon: Boxes, label: "Orders" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/stores", icon: StoreIcon, label: "Stores" },
];

const NAV_ADMIN = [
  { to: "/admin", icon: ShieldCheck, label: "Admin" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function PackageSearchIcon(props: { className?: string }) {
  // Local alias so the nav table stays tidy above.
  return <Warehouse {...props} />;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const stores = useStores();
  const activeStores = (stores ?? []).filter((s) => s.status !== "closed").length;

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-secondary font-medium text-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
      <div className="flex flex-col gap-1">
        <p className="px-2 pb-1 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
          Operations
        </p>
        {NAV_MAIN.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => itemClass(isActive)}
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <p className="px-2 pb-1 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        {NAV_ADMIN.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => itemClass(isActive)}
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-auto rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 font-mono-tight text-xs text-muted-foreground">
          <Activity className="size-3.5 text-status-ok" />
          Chain scope
        </div>
        <p className="mt-1 font-mono-tight text-2xl font-semibold text-primary">
          {activeStores}
        </p>
        <p className="text-xs text-muted-foreground">
          store{activeStores === 1 ? "" : "s"} reporting daily sales
        </p>
      </div>
    </nav>
  );
}

/** StockPilot brand mark: inventory bars under an ascending demand line. */
function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="17" width="4.5" height="9" rx="1.2" fill="currentColor" opacity="0.55" />
      <rect x="12.5" y="13" width="4.5" height="13" rx="1.2" fill="currentColor" opacity="0.75" />
      <rect x="20" y="9" width="4.5" height="17" rx="1.2" fill="currentColor" />
      <path
        d="M6.5 13.5 L13 8.5 L18.5 10.5 L26 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-4">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-primary/12 text-primary"
        title="StockPilot"
      >
        <BrandIcon className="size-5" />
      </span>
      <Link to="/dashboard" className="font-mono-tight text-sm font-semibold tracking-tight">
        stock<span className="text-primary">pilot</span>
      </Link>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const go = (path: string) => {
    setQuery("");
    navigate(path);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length === 0) return;
    go(`/inventory?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={submit} className="relative hidden w-64 md:block" role="search">
      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search inventory…"
        className="h-9 pl-9"
        aria-label="Search inventory"
      />
    </form>
  );
}

function NotificationsBell() {
  const activity = useQuery(api.ops.getActivity, { limit: 8 });
  const [open, setOpen] = useState(false);

  const kindLabel = (kind: string) => {
    switch (kind) {
      case "stock_alert":
        return { label: "Stock alert", className: "text-status-out" };
      case "reorder_recommendation":
        return { label: "Reorder", className: "text-status-low" };
      case "order_status":
        return { label: "Order", className: "text-primary" };
      case "forecast_generated":
        return { label: "Forecast", className: "text-muted-foreground" };
      default:
        return { label: "Update", className: "text-muted-foreground" };
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {activity !== undefined && activity.length > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-status-low" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Notifications
        </div>
        <div className="max-h-80 overflow-y-auto">
          {activity === undefined ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            activity.map((item) => {
              const meta = kindLabel(item.kind);
              return (
                <div
                  key={item.id}
                  className="border-b border-border/60 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`font-mono-tight text-[10px] ${meta.className}`}>
                      {meta.label}
                    </Badge>
                    <span className="font-mono-tight text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-snug">{item.message}</p>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer text-muted-foreground"
            onClick={() => {
              setOpen(false);
              toast("Activity log lives on each store page");
            }}
          >
            View all activity
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = useMemo(() => {
    const source = user?.name ?? user?.email ?? "OP";
    return source.slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-secondary font-mono-tight text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          aria-label="User menu"
        >
          {initials}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user?.name ?? "Operator"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email ?? "demo session"}
          </p>
        </div>
        <div className="my-1 h-px bg-border" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-start gap-2 font-normal"
          onClick={() => navigate("/settings")}
        >
          <Settings className="size-4" /> Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-start gap-2 font-normal text-destructive hover:text-destructive"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <BrandMark />
        <NavLinks />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-3 top-3 z-40 size-9 cursor-pointer lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandMark />
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-mono-tight text-xs text-muted-foreground lg:hidden">
              stock<span className="text-primary">pilot</span>
            </span>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
