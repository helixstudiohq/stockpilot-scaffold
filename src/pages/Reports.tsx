import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useInventoryAnalytics,
  useRecommendations,
  useRevenueSeries,
  useStorePerformance,
  useStores,
} from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatNumber } from "@/utils/format";

type ReportType = "sales" | "inventory" | "forecast" | "reorder" | "stores";

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: "sales", label: "Sales report", description: "Daily revenue and units for the selected range" },
  { value: "inventory", label: "Inventory report", description: "Stock value, health mix and category value" },
  { value: "forecast", label: "Forecast report", description: "Predicted demand per product (demo model)" },
  { value: "reorder", label: "Reorder report", description: "Open recommendations with reasons" },
  { value: "stores", label: "Store performance", description: "Revenue, units and health per store" },
];

interface ReportRun {
  id: string;
  type: ReportType;
  label: string;
  from: string;
  to: string;
  scope: string;
  generatedAt: string;
}

/** Escape user-influenced values before embedding them in the report HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportHtml(run: ReportRun, sections: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>StockPilot ${escapeHtml(run.label)} — ${escapeHtml(run.from)} → ${escapeHtml(run.to)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #161c1a; margin: 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #5b6b66; }
  .meta { color: #5b6b66; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; border-bottom: 1px solid #cfd8d4; padding: 6px 8px; }
  td { border-bottom: 1px solid #e6ebe8; padding: 6px 8px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .brand { font-family: ui-monospace, monospace; font-size: 11px; color: #37544d; margin-bottom: 2px; }
  @media print { body { margin: 16mm; } }
</style>
</head>
<body>
  <div class="brand">stockpilot — demo data</div>
  <h1>${escapeHtml(run.label)}</h1>
  <div class="meta">${escapeHtml(run.from)} → ${escapeHtml(run.to)} · scope: ${escapeHtml(run.scope)} · generated ${escapeHtml(run.generatedAt)}</div>
  ${sections}
</body>
</html>`;
}

function tableHtml(headers: string[], rows: string[][]): string {
  const head = headers
    .map((h, i) => `<th class="${i > 0 ? "num" : ""}">${escapeHtml(h)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) => `<td class="${i > 0 ? "num" : ""}">${escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export default function Reports() {
  const { user } = useAuth();
  const stores = useStores();
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState("all");
  const [history, setHistory] = useState<ReportRun[]>([]);

  const series = useRevenueSeries(180, scope === "all" ? undefined : scope);
  const inventory = useInventoryAnalytics();
  const recommendations = useRecommendations(
    scope === "all" ? {} : { storeId: scope },
  );
  const performance = useStorePerformance(30);

  const generate = () => {
    const days = Math.max(
      1,
      Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1,
    );
    const label = REPORT_TYPES.find((r) => r.value === type)?.label ?? "Report";
    const scopeLabel =
      scope === "all"
        ? "All stores"
        : (stores ?? []).find((s) => s.id === scope)?.name ?? "Store";

    let sections = "";
    if (type === "sales" || type === "stores") {
      const rows = (series ?? [])
        .slice(-days)
        .map((p) => [p.date, formatCurrency(p.revenue), formatNumber(p.units)]);
      sections += `<h2>Sales by day</h2>` + tableHtml(
        ["Date", "Revenue", "Units"],
        rows.length > 0 ? rows : [["—", "—", "—"]],
      );
    }
    if (type === "stores" && performance) {
      sections +=
        `<h2>Store performance (30d)</h2>` +
        tableHtml(
          ["Store", "Revenue", "Units", "Health", "Stockout risk"],
          performance.map((s) => [
            `${s.code} — ${s.name}`,
            formatCurrency(s.revenue),
            formatNumber(s.units),
            `${s.healthRate}%`,
            `${s.stockoutRisk}%`,
          ]),
        );
    }
    if (type === "inventory" && inventory) {
      sections +=
        `<h2>Inventory summary</h2>` +
        tableHtml(
          ["Metric", "Value"],
          [
            ["Stock value (cost)", formatCurrency(inventory.stockValue)],
            ["Units on hand", formatNumber(inventory.unitsOnHand)],
            ["Turnover (30d)", `${inventory.turnover30d.toFixed(2)}×`],
            ["Low-stock rate", `${inventory.lowStockRate}%`],
            ["Stockout rate", `${inventory.stockoutRate}%`],
            ["Overstock rate", `${inventory.overstockRate}%`],
          ],
        ) +
        `<h2>Value by category</h2>` +
        tableHtml(
          ["Category", "Value", "Units"],
          inventory.valueByCategory.map((c) => [
            c.category,
            formatCurrency(c.value),
            formatNumber(c.units),
          ]),
        );
    }
    if (type === "reorder" && recommendations) {
      sections +=
        `<h2>Open reorder recommendations</h2>` +
        tableHtml(
          ["Product", "Store", "Qty", "Priority", "Status", "Reason"],
          recommendations
            .filter((r) => r.status !== "completed")
            .map((r) => [
              `${r.productName} (${r.sku})`,
              r.storeCode,
              formatNumber(r.approvedQty ?? r.recommendedQty),
              r.priority,
              r.status,
              r.reason,
            ]),
        );
    }
    if (type === "forecast" && recommendations) {
      // Forecast table reuses recommendation lead-time demand (model output).
      sections +=
        `<h2>Lead-time demand per position (moving average, demo)</h2>` +
        tableHtml(
          ["Product", "Store", "7d demand", "Safety stock", "Suggested qty"],
          recommendations
            .filter((r) => r.status !== "completed")
            .map((r) => [
              `${r.productName} (${r.sku})`,
              r.storeCode,
              formatNumber(r.leadTimeDemand),
              formatNumber(r.safetyStock),
              formatNumber(r.recommendedQty),
            ]),
        );
    }

    const run: ReportRun = {
      id: `${Date.now()}`,
      type,
      label,
      from,
      to,
      scope: scopeLabel,
      generatedAt: new Date().toLocaleString("en-US"),
    };

    const html = reportHtml(run, sections);
    const win = window.open("", "_blank", "noopener,noreferrer,width=920,height=1200");
    if (win === null) {
      toast.error("Pop-up blocked — allow pop-ups to view generated reports.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    setHistory((prev) => [run, ...prev].slice(0, 8));
    toast.success(`${label} generated — use your browser's print dialog to save as PDF`);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate printable operational reports from live demo data. The output
          opens in a print-ready view — save it as PDF from your browser.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base tracking-tight">New report</CardTitle>
          <CardDescription>
            Report type, range and scope — generated on demand, nothing stored
            server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-type">Report type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger id="report-type" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {REPORT_TYPES.find((r) => r.value === type)?.description}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-store">Store scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="report-store" className="cursor-pointer">
                <SelectValue />
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button className="w-full cursor-pointer gap-2 sm:w-auto" onClick={generate}>
              <FileDown className="size-4" />
              Generate report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base tracking-tight">Session history</CardTitle>
          <CardDescription>
            Reports generated during this session
            {user?.name ? ` by ${user.name}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              Nothing generated yet in this session.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{run.label}</span>
                  <span className="font-mono-tight text-xs text-muted-foreground">
                    {run.from} → {run.to} · {run.scope} · {run.generatedAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
