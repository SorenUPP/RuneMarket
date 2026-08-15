"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, X } from "lucide-react";
import { calculateMargin } from "@/lib/ge-tax";

interface SearchResult {
  id: number;
  name: string;
  iconUrl: string | null;
}

interface ItemStats {
  change24h: number | null;
  change7d: number | null;
  volume24h: number | null;
  volatility24h: number | null;
}

interface ComparedItem {
  id: number;
  name: string;
  iconUrl: string | null;
  high: number | null;
  low: number | null;
  stats: ItemStats | null;
}

const MAX_ITEMS = 4;

function formatGp(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} gp`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(2)}%`;
}

function AddItemSlot({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (item: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (disabled) return null;

  return (
    <div className="relative border border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px]">
      <Plus className="h-5 w-5 text-muted-foreground mb-2" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add item to compare..."
        className="h-8 w-full max-w-[200px] rounded-lg border border-input bg-transparent px-2.5 text-sm text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {results.length > 0 && (
        <ul className="absolute top-full left-1/2 z-10 mt-1 w-56 -translate-x-1/2 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onAdd(r);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {r.iconUrl && <Image src={r.iconUrl} alt="" width={18} height={18} />}
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ItemCompare() {
  const [picked, setPicked] = useState<SearchResult[]>([]);
  const [items, setItems] = useState<Record<number, ComparedItem>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function addItem(item: SearchResult) {
    if (picked.some((p) => p.id === item.id) || picked.length >= MAX_ITEMS) return;
    setPicked((prev) => [...prev, item]);
    setLoadingId(item.id);
    try {
      const [priceRes, statsRes] = await Promise.all([
        fetch(`/api/items/${item.id}/price`),
        fetch(`/api/items/${item.id}/stats`),
      ]);
      const price = priceRes.ok ? await priceRes.json() : null;
      const stats = statsRes.ok ? await statsRes.json() : null;
      setItems((prev) => ({
        ...prev,
        [item.id]: {
          id: item.id,
          name: item.name,
          iconUrl: item.iconUrl,
          high: price?.high ?? null,
          low: price?.low ?? null,
          stats,
        },
      }));
    } finally {
      setLoadingId(null);
    }
  }

  function removeItem(id: number) {
    setPicked((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <div>
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 -mx-4 px-4
          sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4 mb-8"
      >
        {picked.map((p) => {
          const item = items[p.id];
          const margin = item?.high && item?.low ? calculateMargin(item.low, item.high, item.id) : null;
          return (
            <div
              key={p.id}
              className="relative border border-border rounded-lg p-4 shrink-0 w-[80vw] snap-start
                sm:w-auto sm:shrink"
            >
              <button
                onClick={() => removeItem(p.id)}
                aria-label="Remove item"
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
              <Link href={`/item/${p.id}`} className="flex items-center gap-2 mb-3 hover:underline">
                {p.iconUrl && <Image src={p.iconUrl} alt="" width={24} height={24} />}
                <span className="font-medium text-sm truncate">{p.name}</span>
              </Link>

              {loadingId === p.id || !item ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                </div>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Buy</dt>
                    <dd>{formatGp(item.high)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sell</dt>
                    <dd>{formatGp(item.low)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Net margin</dt>
                    <dd className={margin && margin.netProfit >= 0 ? "text-primary" : "text-destructive"}>
                      {margin ? formatGp(margin.netProfit) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">ROI</dt>
                    <dd>{margin ? formatPercent(margin.roiPercent) : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">24h volume</dt>
                    <dd>{item.stats?.volume24h?.toLocaleString("en-US") ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Volatility</dt>
                    <dd>
                      {item.stats?.volatility24h != null ? `${item.stats.volatility24h.toFixed(1)}%` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">24h change</dt>
                    <dd>{formatPercent(item.stats?.change24h)}</dd>
                  </div>
                </dl>
              )}
            </div>
          );
        })}

        {picked.length < MAX_ITEMS && (
          <div className="shrink-0 w-[80vw] snap-start sm:w-auto sm:shrink">
            <AddItemSlot disabled={false} onAdd={addItem} />
          </div>
        )}
      </div>

      {picked.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add up to {MAX_ITEMS} items to compare their margin, volume, and volatility side by side.
        </p>
      )}
    </div>
  );
}
