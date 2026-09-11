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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  useRecommendationActions,
  useRecommendations,
} from "@/hooks/use-data";
import { formatCurrency, formatNumber } from "@/utils/format";
import type { RecommendationStatus } from "@/types/views";

const STATUS_BADGE: Record<RecommendationStatus, string> = {
  suggested: "bg-status-low/15 text-status-low border-status-low/30",
  approved: "bg-primary/10 text-primary border-primary/30",
  ordered: "bg-secondary text-secondary-foreground border-border",
  completed: "bg-status-ok/15 text-status-ok border-status-ok/30",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-status-out/20 text-status-out border-status-out/40",
  high: "bg-status-low/15 text-status-low border-status-low/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-secondary text-muted-foreground border-border",
};

const TABS: Array<{ value: "active" | RecommendationStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "suggested", label: "Suggested" },
  { value: "approved", label: "Approved" },
  { value: "ordered", label: "Ordered" },
  { value: "completed", label: "Completed" },
];

export default function Orders() {
  const [tab, setTab] = useState<"active" | RecommendationStatus>("active");
  const [qtyEdit, setQtyEdit] = useState<{ id: string; qty: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const recommendations = useRecommendations(
    tab === "active" ? {} : { status: tab },
  );
  const { refresh, update } = useRecommendationActions();

  const rows = (recommendations ?? []).filter((r) =>
    tab === "active" ? r.status !== "completed" : true,
  );

  const run = async (id: string, action: Parameters<typeof update>[0]["action"], qty?: number) => {
    setBusyId(id);
    try {
      await update({ id: id as never, action, qty });
      toast.success("Recommendation updated");
    } catch {
      toast.error("Could not update the recommendation");
    } finally {
      setBusyId(null);
    }
  };

  const totalValue = rows.reduce(
    (sum, r) => sum + (r.approvedQty ?? r.recommendedQty) * 0 + r.estimatedCost,
    0,
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Replenishment workflow: review, approve, order and complete.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-2"
          onClick={async () => {
            await refresh({});
            toast.success("Recommendations refreshed from current positions");
          }}
        >
          <ClipboardCheck className="size-4" />
          Refresh recommendations
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="cursor-pointer">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {recommendations === undefined ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="shadow-none">
          <CardHeader className="items-center text-center">
            <PackageCheck className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-lg">Nothing here</CardTitle>
            <CardDescription>
              {tab === "active" || tab === "suggested"
                ? "No open recommendations. Refresh to re-run the engine against current stock."
                : `No ${tab} orders yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base tracking-tight">
              {rows.length} recommendation{rows.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Estimated pipeline value ≈ {formatCurrency(totalValue)} (demo cost
              basis)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="pl-6">
                      <p className="font-medium">{rec.productName}</p>
                      <p className="font-mono-tight text-[11px] text-muted-foreground">
                        {rec.sku}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono-tight text-xs">
                      {rec.storeCode}
                      <div className="mt-1 flex justify-end sm:justify-start">
                        <Badge
                          variant="outline"
                          className={`font-mono-tight text-[10px] ${PRIORITY_BADGE[rec.priority]}`}
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono-tight">
                      {rec.status === "suggested"
                        ? formatNumber(rec.recommendedQty)
                        : formatNumber(rec.approvedQty ?? rec.recommendedQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono-tight text-muted-foreground">
                      {formatCurrency(rec.estimatedCost)}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate text-xs text-muted-foreground" title={rec.reason}>
                        {rec.reason}
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 font-mono-tight text-[10px] ${STATUS_BADGE[rec.status]}`}
                      >
                        {rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex flex-wrap justify-end gap-1">
                        {rec.status === "suggested" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer gap-1 px-2 text-xs"
                              disabled={busyId === rec.id}
                              onClick={() =>
                                setQtyEdit({ id: rec.id, qty: rec.recommendedQty })
                              }
                            >
                              Edit qty
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 cursor-pointer gap-1 px-2 text-xs"
                              disabled={busyId === rec.id}
                              onClick={() => run(rec.id, "approve")}
                            >
                              <CheckCircle2 className="size-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 cursor-pointer gap-1 px-2 text-xs text-muted-foreground"
                              disabled={busyId === rec.id}
                              onClick={() => run(rec.id, "dismiss")}
                            >
                              <X className="size-3" />
                            </Button>
                          </>
                        )}
                        {rec.status === "approved" && (
                          <Button
                            size="sm"
                            className="h-7 cursor-pointer gap-1 px-2 text-xs"
                            disabled={busyId === rec.id}
                            onClick={() => run(rec.id, "mark-ordered")}
                          >
                            <ShoppingCart className="size-3" /> Mark ordered
                          </Button>
                        )}
                        {rec.status === "ordered" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer gap-1 px-2 text-xs"
                            disabled={busyId === rec.id}
                            onClick={() => run(rec.id, "mark-completed")}
                          >
                            <Truck className="size-3" /> Mark completed
                          </Button>
                        )}
                        {rec.status === "completed" && (
                          <span className="font-mono-tight text-xs text-muted-foreground">
                            done
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quantity editor */}
      <Dialog
        open={qtyEdit !== null}
        onOpenChange={(open) => !open && setQtyEdit(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust order quantity</DialogTitle>
            <DialogDescription>
              Overrides the engine&apos;s recommendation for this order.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            value={qtyEdit?.qty ?? 0}
            onChange={(e) =>
              setQtyEdit((prev) =>
                prev ? { ...prev, qty: Number(e.target.value) } : prev,
              )
            }
            aria-label="Order quantity"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setQtyEdit(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              disabled={qtyEdit === null || qtyEdit.qty <= 0}
              onClick={async () => {
                if (!qtyEdit) return;
                await run(qtyEdit.id, "update-qty", qtyEdit.qty);
                setQtyEdit(null);
              }}
            >
              Save quantity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
