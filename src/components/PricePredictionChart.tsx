"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, LineSeries } from "lightweight-charts";

interface HistoricalPoint {
  day: number;
  timestamp: number;
  price: number;
  volume: number;
  ema12: number | null;
  ema26: number | null;
  bbUpper: number | null;
  bbLower: number | null;
}

interface PredictedPoint {
  day: number;
  timestamp: number;
  price: number;
  priceUpper: number;
  priceLower: number;
  projectedVolume: number;
}

interface PredictionResponse {
  historical: HistoricalPoint[];
  predicted: PredictedPoint[];
  meta: {
    insufficientData?: boolean;
    accelerationPerDay2?: number;
    salesDirection?: "accelerating" | "decelerating" | "steady";
    confidence?: number;
    projectedChangePct?: number;
    horizonDays?: number;
    volatilityPct?: number;
    macdSignal?: "bullish" | "bearish" | "neutral";
    macdCrossover?: boolean;
  };
}

export function PricePredictionChart({ itemId }: { itemId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [showEma, setShowEma] = useState(true);
  const [showBands, setShowBands] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/items/${itemId}/prediction?days=7`);
      const json: PredictionResponse = await res.json();
      if (!cancelled) {
        setData(json);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    if (!containerRef.current || !data || data.meta.insufficientData) return;

    const chart: IChartApi = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
      },
      grid: {
        vertLines: { color: "#222" },
        horzLines: { color: "#222" },
      },
      width: containerRef.current.clientWidth,
      height: 320,
      timeScale: { timeVisible: true },
    });

    const actualSeries = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      title: "Actual",
    });
    const predictedSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      title: "Predicted",
      lineStyle: 2, // dashed
    });

    actualSeries.setData(
      data.historical.map((d) => ({ time: d.timestamp as any, value: d.price }))
    );

    // Connect predicted line to the last actual point so there's no visual gap
    const lastActual = data.historical[data.historical.length - 1];
    const predictedData = [
      ...(lastActual ? [{ time: lastActual.timestamp as any, value: lastActual.price }] : []),
      ...data.predicted.map((d) => ({ time: d.timestamp as any, value: d.price })),
    ];
    predictedSeries.setData(predictedData);

    // Forecast confidence band — widens with volatility and horizon. Drawn as
    // two thin dotted lines rather than a filled area to keep it readable
    // alongside the other overlays.
    const upperSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b55",
      title: "Forecast range",
      lineStyle: 3, // dotted
      lineWidth: 1,
    });
    const lowerSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b55",
      lineStyle: 3,
      lineWidth: 1,
    });
    upperSeries.setData([
      ...(lastActual ? [{ time: lastActual.timestamp as any, value: lastActual.price }] : []),
      ...data.predicted.map((d) => ({ time: d.timestamp as any, value: d.priceUpper })),
    ]);
    lowerSeries.setData([
      ...(lastActual ? [{ time: lastActual.timestamp as any, value: lastActual.price }] : []),
      ...data.predicted.map((d) => ({ time: d.timestamp as any, value: d.priceLower })),
    ]);

    let ema12Series: ReturnType<typeof chart.addSeries> | null = null;
    let ema26Series: ReturnType<typeof chart.addSeries> | null = null;
    if (showEma) {
      ema12Series = chart.addSeries(LineSeries, {
        color: "#22c55e",
        title: "EMA 12",
        lineWidth: 1,
      });
      ema26Series = chart.addSeries(LineSeries, {
        color: "#a855f7",
        title: "EMA 26",
        lineWidth: 1,
      });
      ema12Series.setData(
        data.historical
          .filter((d) => d.ema12 !== null)
          .map((d) => ({ time: d.timestamp as any, value: d.ema12 as number }))
      );
      ema26Series.setData(
        data.historical
          .filter((d) => d.ema26 !== null)
          .map((d) => ({ time: d.timestamp as any, value: d.ema26 as number }))
      );
    }

    let bbUpperSeries: ReturnType<typeof chart.addSeries> | null = null;
    let bbLowerSeries: ReturnType<typeof chart.addSeries> | null = null;
    if (showBands) {
      bbUpperSeries = chart.addSeries(LineSeries, {
        color: "#6b7280",
        title: "Bollinger",
        lineWidth: 1,
        lineStyle: 1, // dashed-thin
      });
      bbLowerSeries = chart.addSeries(LineSeries, {
        color: "#6b7280",
        lineWidth: 1,
        lineStyle: 1,
      });
      bbUpperSeries.setData(
        data.historical
          .filter((d) => d.bbUpper !== null)
          .map((d) => ({ time: d.timestamp as any, value: d.bbUpper as number }))
      );
      bbLowerSeries.setData(
        data.historical
          .filter((d) => d.bbLower !== null)
          .map((d) => ({ time: d.timestamp as any, value: d.bbLower as number }))
      );
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, showEma, showBands]);

  const meta = data?.meta;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3">
        <h2 className="font-display text-xl text-foreground">Price Prediction</h2>
        {meta && !meta.insufficientData && (
          <span className="text-xs text-muted-foreground">
            Next {meta.horizonDays}d, based on sales acceleration
          </span>
        )}
      </div>

      {!loading && data && !meta?.insufficientData && (
        <div className="flex flex-wrap gap-4 mb-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={showEma}
              onChange={(e) => setShowEma(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            EMA 12/26
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={showBands}
              onChange={(e) => setShowBands(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            Bollinger bands
          </label>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground mb-2">Loading prediction...</p>}

      {!loading && meta?.insufficientData && (
        <p className="text-sm text-muted-foreground">
          Not enough sales history yet to generate a prediction for this item.
        </p>
      )}

      {!loading && data && !meta?.insufficientData && (
        <>
          <div ref={containerRef} />
          <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Sales trend</p>
              <p className="text-lg font-semibold capitalize">{meta?.salesDirection}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Projected {meta?.horizonDays}d change</p>
              <p
                className={`text-lg font-semibold ${
                  (meta?.projectedChangePct ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {meta?.projectedChangePct !== undefined
                  ? `${meta.projectedChangePct >= 0 ? "+" : ""}${meta.projectedChangePct.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Model confidence</p>
              <p className="text-lg font-semibold">{meta?.confidence ?? 0}%</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Volatility (14d)</p>
              <p className="text-lg font-semibold">
                {meta?.volatilityPct !== undefined ? `${meta.volatilityPct.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                MACD signal{meta?.macdCrossover ? " (crossover)" : ""}
              </p>
              <p
                className={`text-lg font-semibold capitalize ${
                  meta?.macdSignal === "bullish"
                    ? "text-green-500"
                    : meta?.macdSignal === "bearish"
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {meta?.macdSignal ?? "neutral"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            This is a statistical projection assuming recent buy/sell volume keeps changing at its
            current rate. The dotted range shows a volatility-based confidence band, and EMA/MACD/
            Bollinger figures are standard technical indicators — none of this is financial advice,
            since actual prices depend on game updates, player behavior, and other factors this
            model cannot see.
          </p>
        </>
      )}
    </div>
  );
}
