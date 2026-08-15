"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Star } from "lucide-react";
import { FavouriteButton } from "@/components/FavouriteButton";
import { FAVOURITES_CHANGED_EVENT } from "@/components/FavouritesDrawer";
import type { WatchlistItem } from "@/app/api/favourites/watchlist/route";

type SortKey = "grossMargin" | "roiPercent" | "potentialProfit";

function formatGp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} gp`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(2)}%`;
}

export function WatchlistTable() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("roiPercent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/favourites/watchlist");
      if (!res.ok) throw new Error("Failed to load watchlist");
      setItems(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Removing a favourite (star toggle) fires this event — refetch so the
  // row disappears without needing a full page reload.
  useEffect(() => {
    window.addEventListener(FAVOURITES_CHANGED_EVENT, load);
    return () => window.removeEventListener(FAVOURITES_CHANGED_EVENT, load);
  }, [load]);

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

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [items, sortKey, sortDir]);

  const totalPotential = useMemo(
    () => items.reduce((sum, i) => sum + (i.potentialProfit ?? 0), 0),
    [items]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your watchlist...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card py-16 text-center">
        <Star className="size-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No favourites yet — star an item to track its margin here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort control — shared by both table and card views, but only needs
          its own visible row on mobile since the table has sortable headers */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-xs text-muted-foreground">Sort by</span>
        {(
          [
            ["roiPercent", "ROI"],
            ["grossMargin", "Margin"],
            ["potentialProfit", "Potential"],
          ] as [SortKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
              sortKey === key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {label} <SortIcon column={key} />
          </button>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
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
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("potentialProfit")}
                >
                  Potential (4h) <SortIcon column="potentialProfit" />
                </button>
              </th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
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
                {item.hasLivePrice ? (
                  <>
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
                    <td className="px-3 py-2 font-tabular font-medium">
                      {formatGp(item.potentialProfit)}
                    </td>
                  </>
                ) : (
                  <td colSpan={6} className="px-3 py-2 text-muted-foreground">
                    No live GE price available right now.
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <FavouriteButton itemId={item.id} initialFavourited={true} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden flex flex-col gap-3">
        {sorted.map((item) => (
          <div key={item.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link
                href={`/item/${item.id}`}
                className="flex min-w-0 items-center gap-2 font-medium text-foreground"
              >
                {item.iconUrl ? (
                  <Image src={item.iconUrl} alt={item.name} width={24} height={24} />
                ) : (
                  <div className="size-6 shrink-0 rounded bg-muted" />
                )}
                <span className="truncate">{item.name}</span>
              </Link>
              <div className="shrink-0 flex h-11 w-11 items-center justify-center">
                <FavouriteButton itemId={item.id} initialFavourited={true} />
              </div>
            </div>

            {item.hasLivePrice ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Buy</p>
                  <p className="font-tabular">{formatGp(item.buyPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sell</p>
                  <p className="font-tabular">{formatGp(item.sellPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross margin</p>
                  <p className="font-tabular">{formatGp(item.grossMargin)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <p
                    className={`font-tabular font-medium ${
                      (item.roiPercent ?? 0) >= 0 ? "text-chart-2" : "text-destructive"
                    }`}
                  >
                    {formatPercent(item.roiPercent)}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">Potential (4h)</span>
                  <span className="font-tabular font-medium">{formatGp(item.potentialProfit)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No live GE price available right now.</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Combined 4h potential profit across your watchlist:{" "}
        <span className="font-medium text-foreground">{formatGp(totalPotential)}</span>.
        Margins already account for the 2% GE tax (capped at 5m gp/item).
      </p>
    </div>
  );
}
