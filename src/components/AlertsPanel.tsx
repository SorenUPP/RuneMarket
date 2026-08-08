"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Trash2, Loader2 } from "lucide-react";

interface AlertItem {
  id: string;
  itemId: number;
  itemName: string;
  direction: "above" | "below";
  priceType: "high" | "low";
  targetPrice: number;
  triggered: boolean;
  triggeredAt: string | null;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alerts")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAlerts)
      .finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    setRemovingId(id);
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-stone-50/80 p-6 shadow-sm md:col-span-2">
      <div className="mb-4 flex items-center gap-2 border-b border-amber-200/60 pb-3">
        <Bell className="h-5 w-5 text-amber-700" />
        <h2 className="text-lg font-semibold text-stone-900">Price Alerts</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-stone-500">
          No alerts yet — open any item page and tap the bell icon to get notified when its price
          crosses a target.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <Link href={`/item/${a.itemId}`} className="text-sm font-medium text-stone-900 hover:underline">
                  {a.itemName}
                </Link>
                <p className="text-xs text-stone-500">
                  {a.priceType === "low" ? "Sell price" : "Buy price"}{" "}
                  {a.direction === "below" ? "drops below" : "rises above"}{" "}
                  {a.targetPrice.toLocaleString()} gp
                  {a.triggered && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Triggered
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                disabled={removingId === a.id}
                aria-label="Remove alert"
                className="shrink-0 rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
