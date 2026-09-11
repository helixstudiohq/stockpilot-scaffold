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
import { Switch } from "@/components/ui/switch";
import { Bell, Boxes, Database, Store, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { MODELS } from "@/utils/forecasting";

/**
 * Workspace preferences. This is demo scope: values persist to
 * localStorage so the session feels real, but nothing is enforced
 * server-side yet (the FastAPI settings endpoint is on the roadmap).
 */

interface Preferences {
  orgName: string;
  currency: string;
  notifyLowStock: boolean;
  notifyReorderApprovals: boolean;
  notifyDailyDigest: boolean;
  defaultModel: string;
  forecastHorizon: number;
  defaultLeadTimeDays: number;
  serviceLevel: number;
}

const STORAGE_KEY = "stockpilot.preferences.v1";

const DEFAULTS: Preferences = {
  orgName: "Northline Retail Group",
  currency: "USD",
  notifyLowStock: true,
  notifyReorderApprovals: true,
  notifyDailyDigest: false,
  defaultModel: "moving-average-7",
  forecastHorizon: 14,
  defaultLeadTimeDays: 7,
  serviceLevel: 0.95,
};

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

function persist(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode) — preferences stay session-only.
  }
}

export default function Settings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    persist(prefs);
  }, [prefs]);

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profile, organization and operational preferences. Stored locally in
          this demo — server-side persistence lands with the FastAPI backend.
        </p>
      </div>

      {/* Profile */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <User className="size-4 text-primary" /> Profile
          </CardTitle>
          <CardDescription>
            From your workspace account — editing is handled by the auth
            provider in this demo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={user?.name ?? "Operator"}
              readOnly
              className="bg-secondary/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={user?.email ?? "—"}
              readOnly
              className="bg-secondary/40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <Store className="size-4 text-primary" /> Organization
          </CardTitle>
          <CardDescription>
            Workspace identity used across reports and exports.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              value={prefs.orgName}
              onChange={(e) => set("orgName", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-currency">Reporting currency</Label>
            <Select
              value={prefs.currency}
              onValueChange={(v) => set("currency", v)}
            >
              <SelectTrigger id="org-currency" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — US Dollar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="GBP">GBP — British Pound</SelectItem>
                <SelectItem value="IRR">IRR — Iranian Rial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <Bell className="size-4 text-primary" /> Notifications
          </CardTitle>
          <CardDescription>
            Which operational events generate alerts for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(
            [
              [
                "notifyLowStock",
                "Low-stock alerts",
                "When a position crosses its reorder point or stockout threshold.",
              ],
              [
                "notifyReorderApprovals",
                "Reorder workflow updates",
                "When a recommendation is approved, ordered or completed.",
              ],
              [
                "notifyDailyDigest",
                "Daily operations digest",
                "One summary per day instead of per-event alerts.",
              ],
            ] as const
          ).map(([key, title, description]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(checked) => set(key, checked)}
                aria-label={title}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Forecasting preferences */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <Database className="size-4 text-primary" /> Forecasting
          </CardTitle>
          <CardDescription>
            Defaults applied to the Forecasting page and reorder engine. Demo
            models are explainable moving-average / smoothing variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-model">Default model</Label>
            <Select
              value={prefs.defaultModel}
              onValueChange={(v) => set("defaultModel", v)}
            >
              <SelectTrigger id="pref-model" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MODELS).map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-horizon">Forecast horizon (days)</Label>
            <Select
              value={String(prefs.forecastHorizon)}
              onValueChange={(v) => set("forecastHorizon", Number(v))}
            >
              <SelectTrigger id="pref-horizon" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory preferences */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <Boxes className="size-4 text-primary" /> Inventory
          </CardTitle>
          <CardDescription>
            Replenishment defaults used when the reorder engine has no
            product-specific value.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-leadtime">Default lead time (days)</Label>
            <Input
              id="pref-leadtime"
              type="number"
              min={1}
              max={60}
              value={prefs.defaultLeadTimeDays}
              onChange={(e) =>
                set("defaultLeadTimeDays", Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-service">Service level</Label>
            <Select
              value={String(prefs.serviceLevel)}
              onValueChange={(v) => set("serviceLevel", Number(v))}
            >
              <SelectTrigger id="pref-service" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.9">90% — lower carrying cost</SelectItem>
                <SelectItem value="0.95">95% — balanced</SelectItem>
                <SelectItem value="0.98">98% — high availability</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Preferences save automatically.
      </p>
    </div>
  );
}
