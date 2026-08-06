"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, LineSeries } from "lightweight-charts";

interface HistoricalPoint {
  day: number;
  timestamp: number;
  price: number;
  volume: number;
}

interface PredictedPoint {
  day: number;
  timestamp: number;
  price: number;
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
  };
}

export function PricePredictionChart({ itemId }: { itemId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PredictionResponse | null>(null);

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
  }, [data]);

  const meta = data?.meta;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl text-foreground">Price Prediction</h2>
        {meta && !meta.insufficientData && (
          <span className="text-xs text-muted-foreground">
            Next {meta.horizonDays}d, based on sales acceleration
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground mb-2">Loading prediction...</p>}

      {!loading && meta?.insufficientData && (
        <p className="text-sm text-muted-foreground">
          Not enough sales history yet to generate a prediction for this item.
        </p>
      )}

      {!loading && data && !meta?.insufficientData && (
        <>
          <div ref={containerRef} />
          <div className="grid grid-cols-3 gap-3 mt-4">
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
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            This is a statistical projection assuming recent buy/sell volume keeps changing at its
            current rate. It is not financial advice — actual prices depend on game updates,
            player behavior, and other factors this model cannot see.
          </p>
        </>
      )}
    </div>
  );
}
