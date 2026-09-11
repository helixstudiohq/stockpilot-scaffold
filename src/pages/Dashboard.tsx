import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboard, useStores } from "@/hooks/use-dashboard";
import {
  useActivity,
  useProductForecasts,
  useStorePerformance,
} from "@/hooks/use-data";
import { useSeedDemoData } from "@/hooks/use-seed";
import {
  formatCurrency,
  formatDayLabel,
  formatDecimal,
  formatNumber,
  formatSignedPercent,
} from "@/utils/format";
import { useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Coins,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";
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
import type { StockStatus } from "@/types/views";

const RANGES: Array<{ label: string; value: 7 | 14 | 30 }> = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

const STATUS_BADGE: Record<StockStatus, string> = {
  out: "bg-status-out/20 text-status-out border-status-out/40",
  critical: "bg-status-out/20 text-status-out border-status-out/40",
  low: "bg-status-low/15 text-status-low border-status-low/30",
  healthy: "bg-status-ok/15 text-status-ok border-status-ok/30",
  overstocked: "bg-primary/10 text-primary border-primary/30",
};

/** Delta pill for KPI period comparison; `undefined` when not computable. */
function Delta({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono-tight text-xs font-medium ${
        up ? "text-status-ok" : "text-status-out"
      }`}
    >
      <Icon className="size-3" />
      {formatSignedPercent(value)} vs prev.
    </span>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{ date: string; unitsSold: number; revenue: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
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
          width={44}
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
          formatter={(value, name) =>
            name === "Revenue"
              ? [formatCurrency(Number(value)), name]
              : [formatNumber(Number(value)), name]
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
        <Area
          type="monotone"
          dataKey="unitsSold"
          name="Units"
          stroke="var(--chart-2)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const DONUT_COLORS: Record<string, string> = {
  healthy: "var(--status-ok)",
  low: "var(--status-low)",
  critical: "var(--status-out)",
  out: "var(--status-out)",
  overstocked: "var(--chart-2)",
};

function HealthDonut({
  counts,
}: {
  counts: {
    healthy: number;
    low: number;
    critical: number;
    out: number;
    overstocked: number;
  };
}) {
  const data = (
    [
      ["healthy", "Healthy"],
      ["low", "Low"],
      ["critical", "Critical"],
      ["out", "Out"],
      ["overstocked", "Overstocked"],
    ] as const
  )
    .map(([key, label]) => ({ key, label, value: counts[key] }))
    .filter((d) => d.value > 0);
  const total = counts.healthy + counts.low + counts.critical + counts.out + counts.overstocked;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={DONUT_COLORS[entry.key]} />
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
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(
          [
            ["healthy", "Healthy", "bg-status-ok"],
            ["low", "Low", "bg-status-low"],
            ["critical", "Critical", "bg-status-out"],
            ["out", "Out", "bg-status-out"],
            ["overstocked", "Overstocked", "bg-chart-2"],
          ] as const
        ).map(([key, label, dot]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${dot}`} />
            {label} · {counts[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [storeId, setStoreId] = useState<string>("all");
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  const seed = useSeedDemoData();
  const stores = useStores();
  const dashboard = useDashboard({
    storeId: storeId === "all" ? undefined : storeId,
    rangeDays,
  });
  const storePerformance = useStorePerformance(rangeDays);
  const forecasts = useProductForecasts(5);
  const activity = useActivity(7);

  const storeLabel = (
    stores ?? []
  ).find((s) => s.id === storeId)?.name ?? "All stores";

  const health = dashboard?.health;
  const loading = dashboard === undefined;

  const revenueDelta =
    dashboard && dashboard.previousRevenue > 0
      ? ((dashboard.revenue - dashboard.previousRevenue) /
          dashboard.previousRevenue) *
        100
      : undefined;
  const unitsDelta =
    dashboard && dashboard.previousUnitsSold > 0
      ? ((dashboard.unitsSold - dashboard.previousUnitsSold) /
          dashboard.previousUnitsSold) *
        100
      : undefined;

  const attention =
    (health?.counts.out ?? 0) +
    (health?.counts.critical ?? 0) +
    (health?.counts.low ?? 0);

  const kpis = [
    {
      icon: CircleDollarSign,
      label: `Revenue · ${rangeDays}d`,
      value: dashboard ? formatCurrency(dashboard.revenue) : "—",
      delta: revenueDelta,
      sub: "vs previous period of equal length",
    },
    {
      icon: TrendingUp,
      label: `Units sold · ${rangeDays}d`,
      value: dashboard ? formatNumber(dashboard.unitsSold) : "—",
      delta: unitsDelta,
      sub: "chain-wide sell-through",
    },
    {
      icon: Coins,
      label: "Stock value on hand",
      value: health ? formatCurrency(health.totals.stockValue) : "—",
      delta: undefined,
      sub: health
        ? `${formatNumber(health.totals.unitsOnHand)} units at cost`
        : "",
    },
    {
      icon: AlertTriangle,
      label: "Needs attention",
      value: health ? formatNumber(attention) : "—",
      delta: undefined,
      sub: health
        ? `${health.counts.out} out · ${health.counts.critical} critical · ${health.counts.low} low`
        : "",
      alert: attention > 0,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      {/* Heading + filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Inventory control room
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live positions, sales velocity and forecast signals across the
            chain.
            {dashboard?.generatedAt
              ? ` Updated ${new Date(dashboard.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-[190px] cursor-pointer" size="sm">
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
                {kpi.delta !== undefined ? (
                  <div className="mt-0.5">
                    <Delta value={kpi.delta} />
                  </div>
                ) : kpi.sub ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {kpi.sub}
                  </p>
                ) : null}
                {kpi.delta !== undefined && kpi.sub ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {kpi.sub}
                  </p>
                ) : null}
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
              Daily revenue and units · {storeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <TrendChart data={dashboard?.salesTrend ?? []} />
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
            {loading || !health ? (
              <div className="flex h-[240px] items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <HealthDonut counts={health.counts} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action queue + forecast + store performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low-stock action queue */}
        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="tracking-tight">Action queue</CardTitle>
            <CardDescription>
              Out-of-stock, critical and low items — most urgent first. Manage
              replenishment in{" "}
              <Link
                to="/orders"
                className="text-primary underline underline-offset-4"
              >
                Orders
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="flex flex-col gap-2 px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (dashboard?.lowStock ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Nothing needs attention — every tracked position is healthy.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Product</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Avg daily</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                    <TableHead className="text-right">Shortfall</TableHead>
                    <TableHead className="pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.lowStock ?? []).map((item) => (
                    <TableRow key={`${item.storeCode}:${item.product.id}`}>
                      <TableCell className="max-w-[220px] truncate pl-6">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="font-mono-tight text-[11px] text-muted-foreground">
                          {item.product.sku}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono-tight text-xs text-muted-foreground">
                        {item.storeCode}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight">
                        {formatNumber(item.onHand)}
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
                        <Badge
                          variant="outline"
                          className={`font-mono-tight capitalize ${STATUS_BADGE[item.status]}`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Forecast section */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="tracking-tight">
              Forecast spotlight
            </CardTitle>
            <CardDescription>
              Highest predicted 14-day demand (demo model). Full view in{" "}
              <Link
                to="/forecasting"
                className="text-primary underline underline-offset-4"
              >
                Forecasting
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {forecasts === undefined ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : forecasts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No forecast data — seed the demo chain.
              </p>
            ) : (
              forecasts.map((product) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {product.name}
                    </p>
                    <p className="font-mono-tight text-[11px] text-muted-foreground">
                      {formatNumber(product.currentStock)} in stock ·{" "}
                      {product.mape === null
                        ? "no accuracy data"
                        : `${formatDecimal(product.mape)}% MAPE`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono-tight text-sm font-semibold text-primary">
                      {formatNumber(product.predictedTotal)} u
                    </p>
                    <p className="font-mono-tight text-[10px] text-muted-foreground">
                      14-day forecast
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Store performance */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="tracking-tight">Store performance</CardTitle>
            <CardDescription>
              Revenue for the selected window · full list in{" "}
              <Link
                to="/stores"
                className="text-primary underline underline-offset-4"
              >
                Stores
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {storePerformance === undefined ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              storePerformance.slice(0, 5).map((store) => (
                <div key={store.storeId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {store.code}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {store.city}
                      </span>
                    </p>
                    <p className="font-mono-tight text-sm">
                      {formatCurrency(store.revenue)}
                    </p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.max(2, (store.revenue / Math.max(...storePerformance.map((s) => s.revenue), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <ActivityIcon className="size-4 text-primary" /> Recent activity
            </CardTitle>
            <CardDescription>
              Operational events — stock alerts, reorder workflow, inventory
              updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity === undefined ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No activity yet — it fills as alerts and orders happen.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.message}</p>
                      <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                        {item.kind.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-tight text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="pb-4 text-center font-mono-tight text-[11px] text-muted-foreground">
        demo chain · deterministic sample data · simulated forecasting
      </p>
    </div>
  );
}
