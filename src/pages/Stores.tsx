import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, MapPin, Store as StoreIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import {
  useRecommendations,
  useStoreDetail,
  useStorePerformance,
  useStores,
} from "@/hooks/use-data";
import { formatCurrency, formatNumber } from "@/utils/format";

const STATUS_BADGE: Record<string, string> = {
  out: "bg-status-out/15 text-status-out border-status-out/30",
  critical: "bg-status-out/20 text-status-out border-status-out/40",
  low: "bg-status-low/15 text-status-low border-status-low/30",
  healthy: "bg-status-ok/15 text-status-ok border-status-ok/30",
  overstocked: "bg-primary/10 text-primary border-primary/30",
};

function StoreDetail({ storeId }: { storeId: string }) {
  const detail = useStoreDetail(storeId);
  const recommendations = useRecommendations({ storeId });
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground"
          onClick={() => navigate("/stores")}
        >
          <ArrowLeft className="size-4" /> All stores
        </Button>
      </div>

      {detail === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : detail === null ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Store not found</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                  <StoreIcon className="size-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{detail.store.name}</h1>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {detail.store.city || "—"} · {detail.store.code}
                    <Badge variant="outline" className="ml-1.5 font-mono-tight text-[10px] capitalize">
                      {detail.store.status}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                  Revenue · 30d
                </p>
                <p className="font-mono-tight text-xl font-bold">
                  {formatCurrency(detail.revenue30)}
                </p>
              </div>
              <div>
                <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                  Units · 30d
                </p>
                <p className="font-mono-tight text-xl font-bold">
                  {formatNumber(detail.units30)}
                </p>
              </div>
              <div>
                <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                  Open reorders
                </p>
                <p className="font-mono-tight text-xl font-bold">
                  {formatNumber(detail.activeRecommendations)}
                </p>
              </div>
            </div>
          </div>

          {/* Health mix */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base tracking-tight">Stock health</CardTitle>
              <CardDescription>
                Position status across {detail.positions.length} SKUs
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["healthy", detail.counts.healthy],
                  ["low", detail.counts.low],
                  ["critical", detail.counts.critical],
                  ["out", detail.counts.out],
                  ["overstocked", detail.counts.overstocked],
                ] as const
              ).map(([status, count]) => (
                <div key={status} className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
                  <p className="font-mono-tight text-lg font-bold">{count}</p>
                  <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                    {status}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Positions */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base tracking-tight">Positions</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Product</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reorder pt</TableHead>
                    <TableHead className="text-right">Avg daily</TableHead>
                    <TableHead className="pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.positions.map((position) => (
                    <TableRow key={position.productId}>
                      <TableCell className="pl-6">
                        <p className="font-medium">{position.name}</p>
                        <p className="font-mono-tight text-[11px] text-muted-foreground">
                          {position.sku} · {position.category}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono-tight">
                        {formatNumber(position.onHand)}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight text-muted-foreground">
                        {formatNumber(position.reorderPoint)}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight text-muted-foreground">
                        {position.avgDailyUnits.toFixed(1)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Badge
                          variant="outline"
                          className={`font-mono-tight capitalize ${STATUS_BADGE[position.status]}`}
                        >
                          {position.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Active recommendations */}
          {recommendations !== undefined && recommendations.length > 0 && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base tracking-tight">
                  Open recommendations
                </CardTitle>
                <CardDescription>
                  Manage these in the <Link to="/orders" className="text-primary underline underline-offset-4">Orders</Link> workflow
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {recommendations
                  .filter((r) => r.status !== "completed")
                  .map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {rec.productName} — {formatNumber(rec.approvedQty ?? rec.recommendedQty)} units
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono-tight text-[10px] capitalize">
                        {rec.status}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function Stores() {
  const { storeId } = useParams();
  const stores = useStores();
  const performance = useStorePerformance(30);

  if (storeId) {
    return <StoreDetail storeId={storeId} />;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Stores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chain locations with revenue and inventory health at a glance.
        </p>
      </div>

      {stores === undefined || performance === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {stores.map((store) => {
            const perf = performance.find((p) => p.storeId === store.id);
            return (
              <Link key={store.id} to={`/stores/${store.id}`} className="group">
                <Card className="h-full shadow-none transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="tracking-tight">{store.name}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {store.city || "—"} · {store.code}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="font-mono-tight text-[10px] capitalize">
                        {store.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue · 30d</span>
                      <span className="font-mono-tight">
                        {perf ? formatCurrency(perf.revenue) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Units sold</span>
                      <span className="font-mono-tight">
                        {perf ? formatNumber(perf.units) : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Inventory health</span>
                        <span className="font-mono-tight">{perf?.healthRate ?? 0}%</span>
                      </div>
                      <Progress value={perf?.healthRate ?? 0} aria-label={`${store.code} inventory health`} />
                    </div>
                    <p className="font-mono-tight text-[11px] text-muted-foreground">
                      {perf?.lowStockCount ?? 0} position
                      {(perf?.lowStockCount ?? 0) === 1 ? "" : "s"} need attention ·{" "}
                      {perf?.stockoutRisk ?? 0}% stockout risk
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
