"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { calculateMargin } from "@/lib/ge-tax";

interface SearchResult {
  id: number;
  name: string;
  iconUrl: string | null;
}

interface PriceResponse {
  high: number | null;
  low: number | null;
}

function formatGp(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} gp`;
}

export function TaxCalculator() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setResults(await res.json());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function selectItem(item: SearchResult) {
    setSelected(item);
    setQuery(item.name);
    setShowResults(false);
    const res = await fetch(`/api/items/${item.id}/price`);
    if (res.ok) {
      const price: PriceResponse = await res.json();
      if (price.low != null) setBuyPrice(String(price.low));
      if (price.high != null) setSellPrice(String(price.high));
    }
  }

  function clearItem() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  const buyNum = Number(buyPrice) || 0;
  const sellNum = Number(sellPrice) || 0;
  const qtyNum = Math.max(1, Math.floor(Number(quantity) || 1));
  const hasInputs = buyNum > 0 && sellNum > 0;

  const margin = hasInputs
    ? calculateMargin(buyNum, sellNum, selected?.id)
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 font-display text-lg text-foreground">
        Tax &amp; Net Margin Calculator
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Real profit after the 2% GE tax (capped at 5m gp per item).
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Item (optional — autofills current prices)
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search for an item..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
            />
            {query && (
              <button
                type="button"
                onClick={clearItem}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {showResults && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
              {results.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onMouseDown={() => selectItem(item)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {item.iconUrl && (
                    <Image src={item.iconUrl} alt={item.name} width={18} height={18} />
                  )}
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Buy price (gp each)
          </label>
          <Input
            type="number"
            min={0}
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Sell price (gp each)
          </label>
          <Input
            type="number"
            min={0}
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Quantity
          </label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      </div>

      {margin && (
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <Stat label="GE tax / item" value={formatGp(margin.tax)} />
          <Stat label="Gross margin" value={formatGp(margin.grossMargin)} />
          <Stat
            label="Net profit / item"
            value={formatGp(margin.netProfit)}
            tone={margin.netProfit >= 0 ? "good" : "bad"}
          />
          <Stat
            label="ROI"
            value={margin.roiPercent !== null ? `${margin.roiPercent.toFixed(2)}%` : "—"}
            tone={margin.roiPercent !== null && margin.roiPercent >= 0 ? "good" : "bad"}
          />
          <Stat
            label={`Total profit (x${qtyNum.toLocaleString("en-US")})`}
            value={formatGp(margin.netProfit * qtyNum)}
            tone={margin.netProfit >= 0 ? "good" : "bad"}
            span
          />
          <Stat
            label={`Total tax (x${qtyNum.toLocaleString("en-US")})`}
            value={formatGp(margin.tax * qtyNum)}
            span
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  span,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-tabular text-lg font-semibold ${
          tone === "good" ? "text-chart-2" : tone === "bad" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
