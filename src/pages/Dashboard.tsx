import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoDropdown } from "@/components/LogoDropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard, useStores } from "@/hooks/use-dashboard";
import { useSeedDemoData } from "@/hooks/use-seed";
import {
  formatCurrency,
  formatDayLabel,
  formatDecimal,
  formatNumber,
} from "@/utils/format";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  LayoutDashboard,
  Loader2,
  Menu,
  PackageSearch,
  RefreshCw,
  Store as StoreIcon,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InventoryItemView, StockStatus, StoreView } from "@/types/views";

const RANGES: Array<{ label: string; value: 7 | 14 | 30 }> = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

const STATUS_META: Record<
  StockStatus,
  { label: string; className: string; dot: string }
> = {
  out: {
    label: "Out of stock",
    className: "bg-status-out/15 text-status-out border-status-out/30",
    dot: "bg-status-out",
  },
  low: {
    label: "Low",
    className: "bg-status-low/15 text-status-low border-status-low/30",
    dot: "bg-status-low",
  },
  healthy: {
    label: "Healthy",
    className: "bg-status-ok/15 text-status-ok border-status-ok/30",
    dot: "bg-status-ok",
  },
};

function StatusBadge({ status }: { status: StockStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={`gap-1.5 font-mono-tight ${meta.className}`}>
      <span className={`inline-block size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: PackageSearch, label: "Inventory", active: false },
  { icon: TrendingUp, label: "Forecasting", active: false },
  { icon: Boxes, label: "Orders", active: false },
  { icon: Warehouse, label: "Reports", active: false },
];

function SidebarContent({ storeCount }: { storeCount: number }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <LogoDropdown />
      <div className="flex flex-col gap-1">
        <p className="px-2 pb-2 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
          Operations
        </p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={!item.active}
            className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              item.active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
            {!item.active && (
              <span className="ml-auto font-mono-tight text-[10px] text-muted-foreground/50">
                soon
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-auto rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 font-mono-tight text-xs text-muted-foreground">
          <StoreIcon className="size-3.5 text-primary" />
          Chain scope
        </div>
        <p className="mt-1.5 font-mono-tight text-2xl font-semibold text-primary">
          {storeCount}
        </p>
        <p className="text-xs text-muted-foreground">
          store{storeCount === 1 ? "" : "s"} reporting daily sales
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function TrendChart({ data }: { data: Array<{ date: string; unitsSold: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDayLabel(v)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          labelFormatter={(v) => formatDayLabel(String(v))}
          formatter={(value) => [formatNumber(Number(value)), "Units sold"]}
        />
        <Area
          type="monotone"
          dataKey="unitsSold"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HealthDonut({
  counts,
}: {
  counts: { healthy: number; low: number; out: number };
}) {
  const data = [
    { name: "Healthy", value: counts.healthy, color: "var(--status-ok)" },
    { name: "Low", value: counts.low, color: "var(--status-low)" },
    { name: "Out", value: counts.out, color: "var(--status-out)" },
  ];
  const total = counts.healthy + counts.low + counts.out;

  return (
    <div className="relative h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={64}
            outerRadius={88}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-tight text-2xl font-bold">{total}</span>
        <span className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
          positions
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user, signOut, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string>("all");
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const seed = useSeedDemoData();
  const stores: StoreView[] | undefined = useStores();
  const dashboard = useDashboard({
    storeId: storeId === "all" ? undefined : storeId,
    rangeDays,
  });

  const storeLabel = useMemo(() => {
    if (!stores) return "";
    const match = stores.find((s) => s.id === storeId);
    return match ? `${match.code} — ${match.name}` : "All stores";
  }, [stores, storeId]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth?returnTo=%2Fdashboard" replace />;
  }

  const health = dashboard?.health;
  const lowStock: InventoryItemView[] = dashboard?.lowStock ?? [];
  const trend = dashboard?.salesTrend ?? [];
  const outCount = health?.counts.out ?? 0;
  const lowCount = health?.counts.low ?? 0;
  const trendTotalUnits = trend.reduce((sum, p) => sum + p.unitsSold, 0);

  const kpis = [
    {
      icon: CircleDollarSign,
      label: "Stock value on hand",
      value: health ? formatCurrency(health.totals.stockValue) : "—",
      sub: health ? `${formatNumber(health.totals.unitsOnHand)} units` : "",
    },
    {
      icon: Warehouse,
      label: "Tracked SKUs",
      value: health ? formatNumber(health.totals.skuCount) : "—",
      sub: health ? `${health.totals.storeCount} store${health.totals.storeCount === 1 ? "" : "s"} in scope` : "",
    },
    {
      icon: AlertTriangle,
      label: "Needs attention",
      value: health ? formatNumber(outCount + lowCount) : "—",
      sub: health ? `${outCount} out · ${lowCount} low` : "",
      alert: (outCount + lowCount) > 0,
    },
    {
      icon: TrendingUp,
      label: `Units sold · last ${rangeDays}d`,
      value: trendTotalUnits > 0 ? formatNumber(trendTotalUnits) : "—",
      sub: storeLabel,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ------------------------- Desktop sidebar ------------------------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar lg:block">
        <SidebarContent storeCount={stores?.length ?? 0} />
      </aside>

      {/* -------------------------- Mobile sidebar ------------------------- */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger className="lg:hidden" aria-label="Open navigation">
          <span className="flex size-9 items-center justify-center rounded-md border border-border">
            <Menu className="size-4" />
          </span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent storeCount={stores?.length ?? 0} />
        </SheetContent>
      </Sheet>

      {/* ------------------------------ Main ------------------------------- */}
      <main className="min-w-0 flex-1">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono-tight text-xs text-muted-foreground">
              <span className="animate-pulse-dot inline-block size-1.5 rounded-full bg-status-ok" />
              ops://stockpilot/overview
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user?.name ?? user?.email ?? "Operator"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              Sign out
            </Button>
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
          {/* Heading + filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Inventory control room
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Live positions and sales velocity across the chain.
                {dashboard?.generatedAt
                  ? ` Updated ${new Date(dashboard.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="w-[190px] cursor-pointer" size="sm">
                  <StoreIcon className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {(stores ?? []).map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.code} — {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(rangeDays)}
                onValueChange={(v) => setRangeDays(Number(v) as 7 | 14 | 30)}
              >
                <SelectTrigger className="w-[110px] cursor-pointer" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((range) => (
                    <SelectItem key={range.value} value={String(range.value)}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seed / error states */}
          {seed.state === "seeding" && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading sample chain data…
            </div>
          )}
          {seed.state === "error" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm text-status-out">
              <AlertTriangle className="size-4" />
              <span>Couldn&apos;t load sample data: {seed.error}</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto cursor-pointer gap-1.5"
                onClick={seed.retry}
              >
                <RefreshCw className="size-3.5" /> Retry
              </Button>
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="shadow-none">
                <CardContent className="flex items-start justify-between gap-3 px-5 pt-5">
                  <div className="min-w-0">
                    <p className="font-mono-tight text-[11px] uppercase tracking-widest text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="mt-1.5 truncate font-mono-tight text-2xl font-bold tracking-tight">
                      {kpi.value}
                    </p>
                    {kpi.sub && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {kpi.sub}
                      </p>
                    )}
                  </div>
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${
                      kpi.alert
                        ? "border-status-low/40 bg-status-low/10 text-status-low"
                        : "border-border bg-secondary text-primary"
                    }`}
                  >
                    <kpi.icon className="size-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="shadow-none lg:col-span-3">
              <CardHeader>
                <CardTitle className="tracking-tight">Sales trend</CardTitle>
                <CardDescription>
                  Units sold per day · {storeLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard === undefined ? (
                  <div className="flex h-[260px] items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <TrendChart data={trend} />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none lg:col-span-2">
              <CardHeader>
                <CardTitle className="tracking-tight">Stock health</CardTitle>
                <CardDescription>
                  Positions vs. reorder points · {storeLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard === undefined || !health ? (
                  <div className="flex h-[220px] items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <HealthDonut counts={health.counts} />
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-status-ok" />
                        Healthy · {health.counts.healthy}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[--status-low]" />
                        Low · {health.counts.low}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[--status-out]" />
                        Out · {health.counts.out}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Low-stock table */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="tracking-tight">Action queue</CardTitle>
              <CardDescription>
                Out-of-stock and low items, most urgent first. Sorted by status,
                then shortfall depth.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {dashboard === undefined ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : lowStock.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Nothing needs attention — every tracked position is healthy.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Daily velocity</TableHead>
                      <TableHead className="text-right">Days of cover</TableHead>
                      <TableHead className="text-right">Shortfall</TableHead>
                      <TableHead className="pr-6 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((item) => (
                      <TableRow key={`${item.product.id}`}>
                        <TableCell className="max-w-[220px] truncate pl-6 font-medium">
                          {item.product.name}
                        </TableCell>
                        <TableCell className="font-mono-tight text-xs text-muted-foreground">
                          {item.product.sku}
                        </TableCell>
                        <TableCell className="text-right font-mono-tight">
                          {formatNumber(item.onHand)}
                        </TableCell>
                        <TableCell className="text-right font-mono-tight text-muted-foreground">
                          {formatNumber(item.reserved)}
                        </TableCell>
                        <TableCell className="text-right font-mono-tight text-muted-foreground">
                          {formatDecimal(item.avgDailyUnits)}/day
                        </TableCell>
                        <TableCell className="text-right font-mono-tight">
                          {Number.isFinite(item.daysOfCover)
                            ? formatDecimal(item.daysOfCover)
                            : "—"}
                          <span className="ml-1 text-[10px] text-muted-foreground">d</span>
                        </TableCell>
                        <TableCell className="text-right font-mono-tight text-status-low">
                          +{formatNumber(item.shortfallUnits)}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <StatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Separator className="opacity-40" />
          <p className="pb-4 text-center font-mono-tight text-[11px] text-muted-foreground">
            demo chain · deterministic sample data · forecasting module ships next
          </p>
        </div>
      </main>
    </div>
  );
}
