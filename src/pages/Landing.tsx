import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  Factory,
  Gauge,
  LineChart,
  Menu,
  PackageSearch,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import logo from "@/assets/logo.svg";

// ---------------------------------------------------------------------------
// Live feed data (deterministic sample "events" for the terminal demo)
// ---------------------------------------------------------------------------

type FeedKind = "out" | "low" | "ok";
interface FeedEvent {
  time: string;
  kind: FeedKind;
  store: string;
  sku: string;
  product: string;
  units: string;
  detail: string;
}

const FEED: FeedEvent[] = [
  { time: "09:02", kind: "out", store: "DTC-01", sku: "AC-KET-01", product: "Pour-over Kettle", units: "0", detail: "stockout detected" },
  { time: "09:07", kind: "low", store: "RIV-02", sku: "CB-ESP-250", product: "Espresso Blend 250g", units: "6", detail: "below reorder point 24" },
  { time: "09:15", kind: "ok", store: "NSH-03", sku: "FD-GRN-08", product: "Granola Bag 400g", units: "58", detail: "replenishment cycle complete" },
  { time: "09:23", kind: "low", store: "DTC-01", sku: "FD-COK-12", product: "Cookie Box (12-pack)", units: "4", detail: "cover < 1 day at current velocity" },
  { time: "09:31", kind: "ok", store: "RIV-02", sku: "AC-CUP-12", product: "Ceramic Cup (12-pack)", units: "31", detail: "position healthy" },
  { time: "09:44", kind: "out", store: "NSH-03", sku: "SN-TEE-03", product: "Logo Hoodie", units: "0", detail: "size run exhausted" },
  { time: "09:52", kind: "ok", store: "DTC-01", sku: "CB-SIN-1KG", product: "Single Origin 1kg", units: "17", detail: "position healthy" },
  { time: "10:01", kind: "low", store: "RIV-02", sku: "SN-MUG-01", product: "Diner Mug", units: "11", detail: "below reorder point 12" },
  { time: "10:09", kind: "ok", store: "NSH-03", sku: "CB-FIL-250", product: "House Filter 250g", units: "44", detail: "position healthy" },
  { time: "10:17", kind: "out", store: "DTC-01", sku: "FD-GRN-08", product: "Granola Bag 400g", units: "0", detail: "stockout detected" },
  { time: "10:26", kind: "low", store: "NSH-03", sku: "CB-SIN-1KG", product: "Single Origin 1kg", units: "8", detail: "below reorder point 10" },
  { time: "10:33", kind: "ok", store: "DTC-01", sku: "SN-TOT-01", product: "Canvas Tote", units: "39", detail: "position healthy" },
];

const KIND_STYLE: Record<FeedKind, string> = {
  out: "text-status-out",
  low: "text-status-low",
  ok: "text-status-ok",
};

const KIND_LABEL: Record<FeedKind, string> = {
  out: "OUT",
  low: "LOW",
  ok: " OK",
};

const LIVE_STATS = [
  { label: "CHAIN STORES ONLINE", value: "3" },
  { label: "SKUS TRACKED", value: "12" },
  { label: "DAILY SALES ROWS", value: "1,008" },
  { label: "STOCKOUTS FLAGGED", value: "2" },
];

const FEATURES = [
  {
    icon: PackageSearch,
    title: "Stock visibility, per shelf",
    description:
      "On-hand vs. reserved per store and SKU. Healthy, low and out-of-stock states are computed against each product's reorder point — not eyeballed.",
  },
  {
    icon: LineChart,
    title: "Velocity from real sales",
    description:
      "Daily sales aggregates give every item a live days-of-cover figure, so 'how long will this last' is arithmetic, not guesswork.",
  },
  {
    icon: Gauge,
    title: "Days-of-cover lead time",
    description:
      "Low-stock items surface sorted by urgency — stockouts first, then the deepest shortfall — with the units you're short to the day.",
  },
  {
    icon: BarChart3,
    title: "Trend context",
    description:
      "7/14/30-day sales windows with weekday/weekend rhythm visible, so spikes read as pattern instead of panic.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Connect your chain",
    description: "Register stores, catalog SKUs and set reorder points per product.",
  },
  {
    step: "02",
    title: "Stream daily sales",
    description: "Aggregated daily sales per store and SKU build the demand baseline.",
  },
  {
    step: "03",
    title: "Act on signals",
    description: "The dashboard flags what's out, what's low, and how many days you have left.",
  },
];

// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function useCurrentTime() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function TickerItem({ event }: { event: FeedEvent }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-muted-foreground">{event.time}</span>
      <span className={`font-mono-tight ${KIND_STYLE[event.kind]}`}>
        {KIND_LABEL[event.kind]}
      </span>
      <span className="text-foreground/90">
        {event.store} · {event.sku} · {event.product} — {event.units} on hand
      </span>
      <span className="text-muted-foreground/70">({event.detail})</span>
      <ChevronRight className="size-3 text-border" />
    </span>
  );
}

function OpsTerminal() {
  const [visible, setVisible] = useState(5);
  const now = useCurrentTime();

  useEffect(() => {
    const t = setInterval(() => {
      setVisible((v) => (v >= FEED.length ? 5 : v + 1));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/90">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-status-out" />
          <span className="size-2 rounded-full bg-status-low" />
          <span className="size-2 rounded-full bg-status-ok" />
          <span className="ml-2 font-mono-tight text-xs text-muted-foreground">
            ops://stockpilot — inventory watch
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-mono-tight text-xs text-status-ok">
          <span className="animate-pulse-dot inline-block size-1.5 rounded-full bg-status-ok" />
          {now}
        </span>
      </div>
      <div className="scanlines px-4 py-3 font-mono-tight text-xs leading-relaxed">
        {FEED.slice(0, visible).map((event, i) => (
          <motion.p
            key={`${event.time}-${event.sku}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className={i === visible - 1 ? "text-glow" : ""}
          >
            <span className="text-muted-foreground/60">[{event.time}]</span>{" "}
            <span className={KIND_STYLE[event.kind]}>{KIND_LABEL[event.kind]}</span>
            <span className="text-foreground/85">
              {"  "}
              {event.store}/{event.sku}
            </span>
            <span className="text-foreground/50"> — </span>
            <span className="text-foreground/85">
              {event.product}, {event.units} on hand — {event.detail}
            </span>
          </motion.p>
        ))}
        <p className="text-muted-foreground/50">
          <span className="animate-pulse-dot">▍</span> awaiting next sync…
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const now = useCurrentTime();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------ Navbar ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md border border-border bg-card">
              <img src={logo} alt="StockPilot" className="size-5" />
            </span>
            <span className="font-mono-tight text-sm font-semibold tracking-tight">
              stock<span className="text-primary">pilot</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#stats" className="transition-colors hover:text-foreground">Live data</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/dashboard"
              className="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open dashboard
            </Link>
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-border md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-border/70 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-muted-foreground">Features</a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="text-muted-foreground">How it works</a>
              <a href="#stats" onClick={() => setMenuOpen(false)} className="text-muted-foreground">Live data</a>
              <Link to="/dashboard" className="rounded-md bg-primary px-3.5 py-2 text-center font-medium text-primary-foreground">
                Open dashboard
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------- Hero ------------------------------- */}
      <section className="bg-grid relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:pb-24 lg:pt-24">
          <motion.div
            initial="hidden"
            animate="show"
            className="flex flex-col items-start gap-6"
          >
            <motion.div variants={fadeUp} custom={0} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <span className="animate-pulse-dot inline-block size-1.5 rounded-full bg-status-ok" />
              <span className="font-mono-tight text-xs text-muted-foreground">
                chain inventory · live position sync
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              Every store. Every SKU.{" "}
              <span className="text-primary text-glow">Zero surprises.</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              StockPilot is the control room for chain-store inventory: live
              stock positions, sales-driven velocity, and days-of-cover so you
              reorder on signals — not on gut feel.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Launch the dashboard
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                View live demo chain
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-status-ok" /> No data pipeline required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-status-ok" /> Works from one store up
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <OpsTerminal />
          </motion.div>
        </div>
      </section>

      {/* ------------------------------ Ticker ------------------------------ */}
      <div className="overflow-hidden border-y border-border/70 bg-sidebar py-2.5">
        <div className="animate-ticker flex w-max gap-8">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-8" aria-hidden={copy === 1}>
              {FEED.map((event, i) => (
                <TickerItem key={`${copy}-${i}`} event={event} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------- Stats ------------------------------ */}
      <section id="stats" className="border-b border-border/70 bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {LIVE_STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex flex-col gap-1"
            >
              <span className="font-mono-tight text-2xl font-semibold text-primary sm:text-3xl">
                {stat.value}
              </span>
              <span className="font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ----------------------------- Features ----------------------------- */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mb-12 max-w-2xl"
        >
          <p className="font-mono-tight text-xs uppercase tracking-widest text-primary">
            {"// built for the floor"}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Inventory ops without the fog
          </h2>
          <p className="mt-3 text-muted-foreground">
            Position, velocity and coverage computed continuously — the three
            numbers every chain operator actually needs.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: (i % 2) * 0.08 }}
              className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------- How it works --------------------------- */}
      <section id="how" className="border-y border-border/70 bg-sidebar/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 max-w-2xl"
          >
            <p className="font-mono-tight text-xs uppercase tracking-widest text-primary">
              {"// pipeline"}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              From raw sales to reorder signal
            </h2>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="relative"
              >
                <span className="font-mono-tight text-4xl font-bold text-border">
                  {step.step}
                </span>
                <h3 className="mt-3 flex items-center gap-2 font-semibold tracking-tight">
                  {i === 0 && <Store className="size-4 text-primary" />}
                  {i === 1 && <Factory className="size-4 text-primary" />}
                  {i === 2 && <Activity className="size-4 text-primary" />}
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- CTA ------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="bg-grid relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          <div className="relative">
            <Boxes className="mx-auto mb-5 size-9 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stop finding out at the counter
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Open the demo chain, watch the signals, and see what your buying
              team would see at 9 a.m. on a Tuesday.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/dashboard"
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open the dashboard
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------ Footer ------------------------------ */}
      <footer className="border-t border-border/70 bg-sidebar/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="StockPilot" className="size-4" />
            <span className="font-mono-tight">stockpilot</span>
            <span className="text-border">·</span>
            <span>inventory control room</span>
          </div>
          <span className="font-mono-tight text-xs">
            demo data resets with the sample chain
          </span>
        </div>
      </footer>
    </div>
  );
}
