
"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, LineSeries } from "lightweight-charts";

interface HistoryPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

const TIMESTEPS = [
  { label: "1H", value: "5m" },
  { label: "1D", value: "1h" },
  { label: "1W", value: "6h" },
  { label: "1M", value: "24h" },
] as const;

export function PriceChart({ itemId }: { itemId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timestep, setTimestep] = useState<string>("1h");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
      },
      grid: {
        vertLines: { color: "#222" },
        horzLines: { color: "#222" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: { timeVisible: true },
    });
    chartRef.current = chart;

    const highSeries = chart.addSeries(LineSeries, { color: "#22c55e", title: "Buy" });
    const lowSeries = chart.addSeries(LineSeries, { color: "#ef4444", title: "Sell" });

    async function loadData() {
      setLoading(true);
      const res = await fetch(`/api/items/${itemId}/history?timestep=${timestep}`);
      const data: HistoryPoint[] = await res.json();

      const highData = data
        .filter((d) => d.avgHighPrice !== null)
        .map((d) => ({ time: d.timestamp as any, value: d.avgHighPrice! }));
      const lowData = data
        .filter((d) => d.avgLowPrice !== null)
        .map((d) => ({ time: d.timestamp as any, value: d.avgLowPrice! }));

      highSeries.setData(highData);
      lowSeries.setData(lowData);
      chart.timeScale().fitContent();
      setLoading(false);
    }

    loadData();

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
  }, [itemId, timestep]);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {TIMESTEPS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTimestep(t.value)}
            className={`px-3 py-1 text-sm rounded ${
              timestep === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading && <p className="text-sm text-muted-foreground mb-2">Loading chart...</p>}
      <div ref={containerRef} />
    </div>
  );
}