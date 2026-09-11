import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { usePositions, useStores } from "@/hooks/use-data";
import { formatCurrency, formatDecimal, formatNumber } from "@/utils/format";

const STATUS_BADGE: Record<string, string> = {
  out: "bg-status-out/15 text-status-out border-status-out/30",
  critical: "bg-status-out/20 text-status-out border-status-out/40",
  low: "bg-status-low/15 text-status-low border-status-low/30",
  healthy: "bg-status-ok/15 text-status-ok border-status-ok/30",
  overstocked: "bg-primary/10 text-primary border-primary/30",
};

const PAGE_SIZE = 12;

type SortKey = "name" | "onHand" | "daysOfCover" | "avgDailyUnits" | "status";

function ProductDetailDialog({
  storeId,
  productId,
  onClose,
}: {
  storeId: string | null;
  productId: string | null;
  onClose: () => void;
}) {
  const detail = useQuery(
    api.reorders.getProductDetail,
    storeId && productId
      ? { storeId: storeId as Id<"stores">, productId: productId as Id<"products"> }
      : "skip",
  );

  return (
    <Dialog open={storeId !== null && productId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {detail === undefined ? (
          <div className="flex flex-col gap-3 py-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : detail === null ? (
          <DialogHeader>
            <DialogTitle>Not found</DialogTitle>
            <DialogDescription>This position no longer exists.</DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="tracking-tight">
                {detail.product.name}
                <span className="ml-2 font-mono-tight text-sm font-normal text-muted-foreground">
                  {detail.product.sku} · {detail.store.code}
                </span>
              </DialogTitle>
              <DialogDescription>
                {detail.product.category} · {formatCurrency(detail.product.unitPrice)} list ·{" "}
                {formatCurrency(detail.product.unitCost)} cost
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "On hand", value: formatNumber(detail.position?.onHand ?? 0) },
                { label: "Reserved", value: formatNumber(detail.position?.reserved ?? 0) },
                { label: "Reorder point", value: formatNumber(detail.product.reorderPoint) },
                { label: "Safety stock", value: formatNumber(detail.position?.safetyStock ?? 0) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 font-mono-tight text-lg font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                Recommended order
              </p>
              <p className="mt-1 font-mono-tight text-2xl font-bold text-primary">
                {formatNumber(detail.recommendation.recommendedQty)} units
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ≈ {formatCurrency(detail.recommendation.estimatedCost)}
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {detail.recommendation.reason}
              </p>
              <p className="mt-2 font-mono-tight text-[11px] text-muted-foreground">
                lead-time demand {formatNumber(detail.recommendation.leadTimeDemand)} · safety stock{" "}
                {formatNumber(detail.recommendation.safetyStock)} · target{" "}
                {formatNumber(detail.recommendation.targetStock)} · 7-day lead time
              </p>
            </div>

            <div>
              <p className="mb-2 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
                Forecast · next 14 days (moving average, demo model)
              </p>
              <div className="flex items-end gap-1" aria-hidden="true">
                {detail.forecast.map((point) => {
                  const max = Math.max(...detail.forecast.map((p) => p.units), 1);
                  return (
                    <div
                      key={point.date}
                      title={`${point.date}: ${point.units} units`}
                      className="w-full rounded-sm bg-primary/25"
                      style={{ height: `${Math.max(6, (point.units / max) * 72)}px` }}
                    />
                  );
                })}
              </div>
              <p className="mt-2 font-mono-tight text-[11px] text-muted-foreground">
                total forecast demand ≈{" "}
                {formatNumber(detail.forecast.reduce((s, p) => s + p.units, 0))} units
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [storeFilter, setStoreFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<{ storeId: string; productId: string } | null>(null);

  const stores = useStores();
  const positions = usePositions(storeFilter === "all" ? undefined : storeFilter);

  const categories = useMemo(() => {
    const set = new Set((positions ?? []).map((p) => p.category));
    return Array.from(set).sort();
  }, [positions]);

  const filtered = useMemo(() => {
    const rows = positions ?? [];
    const q = search.trim().toLowerCase();
    const rank: Record<string, number> = {
      out: 0,
      critical: 1,
      low: 2,
      healthy: 3,
      overstocked: 4,
    };
    const matched = rows.filter((row) => {
      if (q && !`${row.name} ${row.sku} ${row.category}`.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });

    matched.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "onHand":
          cmp = a.onHand - b.onHand;
          break;
        case "daysOfCover":
          cmp = a.daysOfCover - b.daysOfCover;
          break;
        case "avgDailyUnits":
          cmp = a.avgDailyUnits - b.avgDailyUnits;
          break;
        case "status":
          cmp = rank[a.status] - rank[b.status];
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return matched;
  }, [positions, search, categoryFilter, statusFilter, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every SKU position across the chain, with live health classification.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search name, SKU or category…"
            className="pl-9"
            aria-label="Search inventory"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={storeFilter}
            onValueChange={(v) => {
              setStoreFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px] cursor-pointer" size="sm">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {(stores ?? []).map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px] cursor-pointer" size="sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px] cursor-pointer" size="sm">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="overstocked">Overstocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-none">
        <CardContent className="px-0">
          {positions === undefined ? (
            <div className="flex flex-col gap-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageSearch />
                </EmptyMedia>
                <EmptyTitle>No matching positions</EmptyTitle>
                <EmptyDescription>
                  {positions.length === 0
                    ? "Seed the demo chain to populate inventory."
                    : "Try a different search or clear the filters."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => toggleSort("name")}>
                        Product <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => toggleSort("onHand")}>
                        On hand <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead>Reorder pt</TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => toggleSort("avgDailyUnits")}>
                        Avg daily <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => toggleSort("daysOfCover")}>
                        Days left <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="pr-6 text-right">
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => toggleSort("status")}>
                        Status <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow
                      key={row.key}
                      className="cursor-pointer"
                      onClick={() => setDetail({ storeId: row.storeId, productId: row.productId })}
                    >
                      <TableCell className="pl-6">
                        <p className="font-medium">{row.name}</p>
                        <p className="font-mono-tight text-[11px] text-muted-foreground">
                          {row.sku} · {row.category}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono-tight text-xs">{row.storeCode}</TableCell>
                      <TableCell className="text-right font-mono-tight">
                        {formatNumber(row.onHand)}
                        {row.reserved > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({formatNumber(row.reserved)} res.)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight text-muted-foreground">
                        {formatNumber(row.reorderPoint)}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight text-muted-foreground">
                        {formatDecimal(row.avgDailyUnits)}
                      </TableCell>
                      <TableCell className="text-right font-mono-tight">
                        {Number.isFinite(row.daysOfCover) ? formatDecimal(row.daysOfCover) : "∞"}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Badge
                          variant="outline"
                          className={`font-mono-tight capitalize ${STATUS_BADGE[row.status]}`}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between border-t border-border px-6 py-3">
                <p className="font-mono-tight text-xs text-muted-foreground">
                  {filtered.length} positions · page {safePage + 1} of {pageCount}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 cursor-pointer"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 cursor-pointer"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductDetailDialog
        storeId={detail?.storeId ?? null}
        productId={detail?.productId ?? null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
