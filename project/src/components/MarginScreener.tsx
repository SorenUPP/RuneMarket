"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ScreenerItem } from "@/app/api/items/screener/route";

type SortKey = "grossMargin" | "roiPercent" | "potentialProfit";

const SORT_LABELS: Record<SortKey, string> = {
  grossMargin: "Gross margin",
  roiPercent: "ROI %",
  potentialProfit: "Potential profit (4h limit)",
};

function formatGp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString()} gp`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(2)}%`;
}

export function MarginScreener() {
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [minRoi, setMinRoi] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("grossMargin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/items/screener")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load screener data");
        return res.json();
      })
      .then((data: ScreenerItem[]) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minMarginNum = minMargin.trim() === "" ? null : Number(minMargin);
    const minRoiNum = minRoi.trim() === "" ? null : Number(minRoi);

    let rows = items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (minMarginNum !== null && item.grossMargin < minMarginNum) return false;
      if (
        minRoiNum !== null &&
        (item.roiPercent === null || item.roiPercent < minRoiNum)
      )
        return false;
      return true;
    });

    rows = rows.sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return rows.slice(0, 200);
  }, [items, query, minMargin, minRoi, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (column !== sortKey)
      return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />;
    return sortDir === "desc" ? (
      <ArrowDown className="size-3.5 text-primary" />
    ) : (
      <ArrowUp className="size-3.5 text-primary" />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="Filter by item name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Min margin (gp)
          </label>
          <Input
            type="number"
            placeholder="e.g. 1000"
            value={minMargin}
            onChange={(e) => setMinMargin(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Min ROI %
          </label>
          <Input
            type="number"
            placeholder="e.g. 2"
            value={minRoi}
            onChange={(e) => setMinRoi(e.target.value)}
          />
        </div>
        {(query || minMargin || minRoi) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setMinMargin("");
              setMinRoi("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Buy</th>
              <th className="px-3 py-2 font-medium">Sell</th>
              <th className="px-3 py-2 font-medium">Tax</th>
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("grossMargin")}
                >
                  Gross margin <SortIcon column="grossMargin" />
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Net profit</th>
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("roiPercent")}
                >
                  ROI <SortIcon column="roiPercent" />
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Buy limit</th>
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("potentialProfit")}
                >
                  Potential (4h) <SortIcon column="potentialProfit" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                  Loading live GE prices...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-destructive">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No items match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/item/${item.id}`}
                      className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                    >
                      {item.iconUrl ? (
                        <Image src={item.iconUrl} alt={item.name} width={20} height={20} />
                      ) : (
                        <div className="size-5 rounded bg-muted" />
                      )}
                      <span className="max-w-[220px] truncate">{item.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-tabular text-muted-foreground">
                    {formatGp(item.buyPrice)}
                  </td>
                  <td className="px-3 py-2 font-tabular text-muted-foreground">
                    {formatGp(item.sellPrice)}
                  </td>
                  <td className="px-3 py-2 font-tabular text-muted-foreground">
                    {formatGp(item.tax)}
                  </td>
                  <td className="px-3 py-2 font-tabular">{formatGp(item.grossMargin)}</td>
                  <td
                    className={`px-3 py-2 font-tabular font-medium ${
                      item.netProfit >= 0 ? "text-chart-2" : "text-destructive"
                    }`}
                  >
                    {formatGp(item.netProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 font-tabular font-medium ${
                      (item.roiPercent ?? 0) >= 0 ? "text-chart-2" : "text-destructive"
                    }`}
                  >
                    {formatPercent(item.roiPercent)}
                  </td>
                  <td className="px-3 py-2 font-tabular text-muted-foreground">
                    {item.buyLimit?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-tabular font-medium">
                    {formatGp(item.potentialProfit)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          Showing top {filtered.length} of {items.length.toLocaleString()} tracked items,
          sorted by {SORT_LABELS[sortKey].toLowerCase()} ({sortDir === "desc" ? "highest first" : "lowest first"}).
          Margins already account for the 2% GE tax (capped at 5m gp/item).
        </p>
      )}
    </div>
  );
}
