import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCategoryPerformance,
  useInventoryAnalytics,
  useRevenueSeries,
  useStorePerformance,
  useTopProducts,
} from "@/hooks/use-data";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDayLabel, formatNumber } from "@/utils/format";

function RevenueTrend() {
  const series = useRevenueSeries(90);
  if (series === undefined) return <Skeleton className="h-72 w-full" />;
  return (
    <div className="h-72" role="img" aria-label="Revenue over the last 90 days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDayLabel(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}k`}
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
            formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
          />
          <Bar dataKey="revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryChart() {
  const categories = useCategoryPerformance(30);
  if (categories === undefined) return <Skeleton className="h-64 w-full" />;
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div className="h-64" role="img" aria-label="Revenue share by category, last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categories}
            dataKey="revenue"
            nameKey="category"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
            strokeWidth={0}
          >
            {categories.map((entry, i) => (
              <Cell key={entry.category} fill={palette[i % palette.length]} />
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
            formatter={(value) => formatCurrency(Number(value))}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {categories.map((entry, i) => (
          <span key={entry.category} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: palette[i % palette.length] }}
            />
            {entry.category}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const inventory = useInventoryAnalytics();
  const topProducts = useTopProducts(30, 8);
  const storePerformance = useStorePerformance(30);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sales, inventory and store performance across the chain.
        </p>
      </div>

      {/* Inventory analytics KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Inventory value",
            value: inventory ? formatCurrency(inventory.stockValue) : "—",
            sub: inventory ? `${formatNumber(inventory.unitsOnHand)} units at cost` : "",
          },
          {
            label: "Turnover · 30d",
            value: inventory ? `${inventory.turnover30d.toFixed(2)}×` : "—",
            sub: "units sold ÷ units on hand",
          },
          {
            label: "Low-stock rate",
            value: inventory ? `${inventory.lowStockRate}%` : "—",
            sub: inventory ? `${inventory.stockoutRate}% fully stocked out` : "",
          },
          {
            label: "Overstock rate",
            value: inventory ? `${inventory.overstockRate}%` : "—",
            sub: "positions > 3× reorder point",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="shadow-none">
            <CardContent className="px-5 pt-5">
              <p className="font-mono-tight text-[11px] uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1.5 truncate font-mono-tight text-2xl font-bold">{kpi.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle className="tracking-tight">Revenue · last 90 days</CardTitle>
            <CardDescription>Chain-wide daily revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueTrend />
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="tracking-tight">Category mix · 30d</CardTitle>
            <CardDescription>Revenue share by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="tracking-tight">Top products · 30d</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {topProducts === undefined ? (
              <div className="flex flex-col gap-2 px-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={product.productId}>
                      <TableCell className="w-8 pl-6 font-mono-tight text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="font-mono-tight text-[11px] text-muted-foreground">
                          {product.category} · {formatNumber(product.units)} units
                        </p>
                      </TableCell>
                      <TableCell className="pr-6 text-right font-mono-tight">
                        {formatCurrency(product.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Store comparison */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="tracking-tight">Store comparison · 30d</CardTitle>
            <CardDescription>Revenue and inventory health side by side</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {storePerformance === undefined ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              storePerformance.map((store) => (
                <div key={store.storeId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {store.code}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {store.name}
                      </span>
                    </p>
                    <p className="font-mono-tight text-sm">{formatCurrency(store.revenue)}</p>
                  </div>
                  <Progress value={store.healthRate} aria-label={`${store.code} health rate`} />
                  <p className="font-mono-tight text-[11px] text-muted-foreground">
                    {store.healthRate}% healthy · {formatNumber(store.units)} units ·{" "}
                    {store.stockoutRisk}% stockout risk
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
