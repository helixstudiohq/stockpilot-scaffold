/**
 * Forecasting domain — pure, UI-free functions.
 *
 * The default model family is deliberately simple and explainable (moving
 * average and exponential smoothing) so every number shown in the UI can be
 * re-derived by hand. The `ModelId` union and `ForecastModel` interface are
 * the extension points for future models (e.g. Prophet) without touching UI
 * or data-layer code.
 */

export type ModelId = "moving-average-7" | "moving-average-28" | "exp-smoothing";

export interface ForecastModel {
  id: ModelId;
  label: string;
  description: string;
  /** Forecast `horizon` future days from a daily-units history (oldest first). */
  forecast(history: number[], horizon: number): number[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Centered moving average baseline, flat forecast at the final window mean. */
function movingAverageForecast(history: number[], window: number, horizon: number): number[] {
  if (history.length === 0) return Array.from({ length: horizon }, () => 0);
  const take = Math.min(window, history.length);
  const baseline = mean(history.slice(-take));
  return Array.from({ length: horizon }, () => Math.max(0, round2(baseline)));
}

export const MODELS: Record<ModelId, ForecastModel> = {
  "moving-average-7": {
    id: "moving-average-7",
    label: "Moving average · 7d",
    description: "Mean of the last 7 days of demand, held flat across the horizon.",
    forecast: (history, horizon) => movingAverageForecast(history, 7, horizon),
  },
  "moving-average-28": {
    id: "moving-average-28",
    label: "Moving average · 28d",
    description: "Mean of the last 28 days of demand, held flat across the horizon.",
    forecast: (history, horizon) => movingAverageForecast(history, 28, horizon),
  },
  "exp-smoothing": {
    id: "exp-smoothing",
    label: "Exponential smoothing",
    description:
      "Weighted mean biased toward recent demand (α = 0.25), held flat across the horizon.",
    forecast: (history, horizon) => {
      if (history.length === 0) {
        return Array.from({ length: horizon }, () => 0);
      }
      const alpha = 0.25;
      let level = history[0] ?? 0;
      for (const units of history.slice(1)) {
        level = alpha * units + (1 - alpha) * level;
      }
      return Array.from({ length: horizon }, () => Math.max(0, round2(level)));
    },
  },
};

export const DEFAULT_MODEL: ModelId = "moving-average-7";

// ---------------------------------------------------------------------------
// Evaluation (backtesting metrics)
// ---------------------------------------------------------------------------

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number | null;
}

function absolutePercentageError(actual: number, predicted: number): number | null {
  if (actual === 0) return null; // undefined MAPE on zero-demand days
  return Math.abs((actual - predicted) / actual) * 100;
}

/**
 * Rolling-origin backtest: on each of the last `folds` days, fit on the
 * history available up to that day and score the one-step-ahead prediction.
 */
export function evaluateModel(
  history: number[],
  model: ForecastModel,
  folds = 14,
): AccuracyMetrics {
  const usableFolds = Math.min(folds, Math.max(0, history.length - 1));
  if (usableFolds === 0) {
    return { mae: 0, rmse: 0, mape: null };
  }

  const errors: number[] = [];
  const apes: number[] = [];
  for (let i = usableFolds; i >= 1; i--) {
    const train = history.slice(0, history.length - i);
    const actual = history[history.length - i] ?? 0;
    const predicted = model.forecast(train, 1)[0] ?? 0;
    errors.push(Math.abs(actual - predicted));
    const ape = absolutePercentageError(actual, predicted);
    if (ape !== null) apes.push(ape);
  }

  const mae = mean(errors);
  const mse = mean(errors.map((e) => e * e));
  return {
    mae: round2(mae),
    rmse: round2(Math.sqrt(mse)),
    mape: apes.length > 0 ? round2(mean(apes)) : null,
  };
}

/**
 * Width of the demo confidence band around a forecast point, in units.
 * Scaled from the observed in-sample error so the band widens with volatility
 * rather than being an arbitrary constant.
 */
export function bandHalfWidth(history: number[], model: ForecastModel, folds = 14): number {
  const { mae } = evaluateModel(history, model, folds);
  return round2(Math.max(1.5, mae * 1.96));
}

/** Mean absolute daily demand over the trailing `window` days. */
export function avgDailyDemand(history: number[], window = 14): number {
  return round2(mean(history.slice(-window)));
}

/** A small trend signal in units/day, positive when demand is accelerating. */
export function trendPerDay(history: number[], window = 28): number {
  const recent = history.slice(-window);
  if (recent.length < 4) return 0;
  const half = Math.floor(recent.length / 2);
  const older = mean(recent.slice(0, half));
  const newer = mean(recent.slice(half));
  return round2((newer - older) / Math.max(1, recent.length / 2));
}
