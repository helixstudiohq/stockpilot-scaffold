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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Info } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayLabel, formatDecimal, formatNumber } from "@/utils/format";
import { MODELS } from "@/utils/forecasting";

const MODEL_OPTIONS = Object.values(MODELS);

const HISTORY_DAYS = 60;
const HORIZON = 14;

export default function Forecasting() {
  const [productId, setProductId] = useState<string>("first");
  const [modelId, setModelId] = useState<string>("moving-average-7");

  const products = useQuery(api.forecasting.getProductForecasts, { limit: 20 });
  const detail = useQuery(
    api.forecasting.getForecast,
    productId === "first"
      ? { modelId, horizon: HORIZON }
      : {
          productId: productId as Id<"products">,
          modelId,
          horizon: HORIZON,
        },
  );

  const chartData = useMemoChart(detail);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Forecasting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explainable demand forecasts from the deterministic demo dataset.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-[220px] cursor-pointer" size="sm">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">Top forecast product</SelectItem>
              {(products ?? []).map((product) => (
                <SelectItem key={product.productId} value={product.productId}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="w-[190px] cursor-pointer" size="sm">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {detail === undefined || products === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : detail === null ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>No forecast data</CardTitle>
            <CardDescription>
              Seed the demo chain to generate demand history.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Model",
                value: detail.model.label.replace(/·.*/, "").trim(),
                sub: `${detail.horizon}-day horizon`,
              },
              {
                label: "Forecast daily avg",
                value: `${formatDecimal(
                  detail.forecast.reduce((s, p) => s + p.units, 0) / detail.forecast.length,
                )} u/day`,
                sub: `≈ ${formatNumber(
                  detail.forecast.reduce((s, p) => s + p.units, 0),
                )} units total`,
              },
              {
                label: "MAE / RMSE",
                value: `${formatDecimal(detail.metrics.mae)} / ${formatDecimal(detail.metrics.rmse)}`,
                sub: "backtest · 14 folds (units)",
              },
              {
                label: "MAPE",
                value: detail.metrics.mape === null ? "—" : `${formatDecimal(detail.metrics.mape)}%`,
                sub: "lower is better",
              },
            ].map((stat) => (
              <Card key={stat.label} className="shadow-none">
                <CardContent className="px-5 pt-5">
                  <p className="font-mono-tight text-[11px] uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1.5 truncate font-mono-tight text-xl font-bold">{stat.value}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="tracking-tight">
                {detail.product.name} — history vs forecast
              </CardTitle>
              <CardDescription>
                {detail.history.length} days of chain-wide demand and a{" "}
                {detail.horizon}-day forecast with ~95% band. Demo data, simulated
                forecasting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72" role="img" aria-label={`Demand history and forecast for ${detail.product.name}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => formatDayLabel(v)}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      minTickGap={28}
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
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="history"
                      name="Historical demand"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#histFill)"
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      name="Upper band"
                      stroke="var(--chart-2)"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      fill="none"
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      name="Lower band"
                      stroke="var(--chart-2)"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      fill="none"
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base tracking-tight">
                <Info className="size-4 text-primary" /> How this forecast works
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">{detail.model.label}:</span>{" "}
                {detail.model.description}
              </p>
              <p>
                The confidence band is derived from rolling-origin backtest error
                (±1.96 × MAE), not a hard-coded constant. Metrics above are
                computed on the last 14 days of demo history.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Merge history + forecast into one chart series with gaps for each other. */
function useMemoChart(
  detail:
    | {
        history: Array<{ date: string; units: number }>;
        forecast: Array<{ date: string; units: number; lower: number; upper: number }>;
      }
    | null
    | undefined,
) {
  if (!detail) return [];
  const rows: Array<{
    date: string;
    history: number | null;
    forecast: number | null;
    lower: number | null;
    upper: number | null;
  }> = detail.history.map((p) => ({
    date: p.date,
    history: p.units,
    forecast: null,
    lower: null,
    upper: null,
  }));
  for (let i = 0; i < detail.forecast.length; i++) {
    const point = detail.forecast[i]!;
    if (i === 0 && rows.length > 0) {
      // Bridge the seam so the two series connect visually.
      rows[rows.length - 1]!.forecast = point.units;
      rows[rows.length - 1]!.lower = point.lower;
      rows[rows.length - 1]!.upper = point.upper;
    }
    rows.push({
      date: point.date,
      history: null,
      forecast: point.units,
      lower: point.lower,
      upper: point.upper,
    });
  }
  return rows;
}
