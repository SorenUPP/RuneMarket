"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Download,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FavouriteButton } from "@/components/FavouriteButton";
import { FAVOURITES_CHANGED_EVENT } from "@/components/FavouritesDrawer";
import { createClient } from "@/lib/supabase/client";
import type { ScreenerItem } from "@/app/api/items/screener/route";

type SortKey =
  | "grossMargin"
  | "roiPercent"
  | "potentialProfit"
  | "volume"
  | "flipScore";

type Membership = "all" | "f2p" | "members";

const SORT_LABELS: Record<SortKey, string> = {
  grossMargin: "Gross margin",
  roiPercent: "ROI %",
  potentialProfit: "Potential profit (4h limit)",
  volume: "Trade volume (5m)",
  flipScore: "Flip score",
};

const STALE_WARN_SECONDS = 30 * 60; // 30 min — price may be unreliable
const STALE_BAD_SECONDS = 2 * 60 * 60; // 2h — treat as effectively dead

interface Preset {
  label: string;
  description: string;
  apply: () => void;
}

function formatGp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} gp`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(2)}%`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return "no trades";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function toCsv(rows: ScreenerItem[]): string {
  const header = [
    "Item",
    "Buy",
    "Sell",
    "Tax",
    "Gross margin",
    "Net profit",
    "ROI %",
    "Buy limit",
    "Potential (4h)",
    "Volume (5m)",
    "Members",
    "Last traded (s ago)",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.buyPrice,
      r.sellPrice,
      r.tax,
      r.grossMargin,
      r.netProfit,
      r.roiPercent ?? "",
      r.buyLimit ?? "",
      r.potentialProfit ?? "",
      r.volume,
      r.members ? "yes" : "no",
      r.updatedSecondsAgo ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export function MarginScreener() {
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [minRoi, setMinRoi] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [budget, setBudget] = useState("");
  const [membership, setMembership] = useState<Membership>("all");
  const [hideStale, setHideStale] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("flipScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [userId, setUserId] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const loadScreener = useCallback(() => {
    return fetch("/api/items/screener")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load screener data");
        return res.json();
      })
      .then((data: ScreenerItem[]) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message ?? "Something went wrong");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadScreener().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadScreener();
    } finally {
      setRefreshing(false);
    }
  }

  // Track sign-in state and current favourites so rows can be starred
  // directly from the screener without a trip to the item page.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadFavourites = () => {
    fetch("/api/favourites")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: number }[]) => setFavouriteIds(new Set(data.map((d) => d.id))))
      .catch(() => setFavouriteIds(new Set()));
  };

  useEffect(() => {
    if (!userId) {
      setFavouriteIds(new Set());
      return;
    }
    loadFavourites();
    window.addEventListener(FAVOURITES_CHANGED_EVENT, loadFavourites);
    return () => window.removeEventListener(FAVOURITES_CHANGED_EVENT, loadFavourites);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const presets: Preset[] = [
    {
      label: "High volume",
      description: "Liquid flips — orders fill fast",
      apply: () => {
        setMinVolume("500");
        setMinMargin("");
        setMinRoi("");
        setMembership("all");
      },
    },
    {
      label: "Big ticket",
      description: "1m+ gross margin per item",
      apply: () => {
        setMinMargin("1000000");
        setMinVolume("");
        setMinRoi("");
      },
    },
    {
      label: "Quick flips",
      description: "High ROI, low buy-in",
      apply: () => {
        setMinRoi("3");
        setMinMargin("");
        setMinVolume("50");
      },
    },
    {
      label: "F2P only",
      description: "No members items",
      apply: () => setMembership("f2p"),
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minMarginNum = minMargin.trim() === "" ? null : Number(minMargin);
    const minRoiNum = minRoi.trim() === "" ? null : Number(minRoi);
    const minVolumeNum = minVolume.trim() === "" ? null : Number(minVolume);
    const budgetNum = budget.trim() === "" ? null : Number(budget);

    let rows = items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (minMarginNum !== null && item.grossMargin < minMarginNum) return false;
      if (
        minRoiNum !== null &&
        (item.roiPercent === null || item.roiPercent < minRoiNum)
      )
        return false;
      if (minVolumeNum !== null && item.volume < minVolumeNum) return false;
      if (membership === "f2p" && item.members) return false;
      if (membership === "members" && !item.members) return false;
      if (hideStale && (item.updatedSecondsAgo === null || item.updatedSecondsAgo > STALE_WARN_SECONDS))
        return false;
      if (budgetNum !== null && budgetNum > 0 && item.buyPrice > budgetNum) return false;
      return true;
    });

    rows = rows.sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return rows.slice(0, 200);
  }, [items, query, minMargin, minRoi, minVolume, budget, membership, hideStale, sortKey, sortDir]);

  const budgetNum = budget.trim() === "" ? null : Number(budget);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setQuery("");
    setMinMargin("");
    setMinRoi("");
    setMinVolume("");
    setBudget("");
    setMembership("all");
    setHideStale(false);
  }

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runemarket-screener.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  const hasFilters =
    query || minMargin || minRoi || minVolume || budget || membership !== "all" || hideStale;

  return (
    <div className="space-y-4">
      {/* Quick presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Presets</span>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={preset.apply}
            title={preset.description}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing || loading}
          className="ml-auto"
          aria-label="Refresh prices"
          title="Refresh live GE prices"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 sm:flex-1 sm:min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="Filter by item name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-32">
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
        <div className="sm:w-28">
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
        <div className="sm:w-28">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Min volume
          </label>
          <Input
            type="number"
            placeholder="e.g. 100"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
          />
        </div>
        <div className="sm:w-36">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            My capital (gp)
          </label>
          <Input
            type="number"
            placeholder="e.g. 5000000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="col-span-2 sm:col-auto">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Access
          </label>
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(["all", "f2p", "members"] as Membership[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMembership(m)}
                className={`flex-1 rounded-md px-2.5 py-2 sm:py-1.5 font-medium capitalize transition-colors ${
                  membership === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "f2p" ? "F2P" : m}
              </button>
            ))}
          </div>
        </div>
        <label className="col-span-2 sm:col-auto flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={hideStale}
            onChange={(e) => setHideStale(e.target.checked)}
            className="size-4 sm:size-3.5 rounded accent-primary"
          />
          Hide stale prices
        </label>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="col-span-2 sm:col-auto">
            Clear filters
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="col-span-2 sm:col-auto sm:ml-auto"
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Mobile: sort chips (table headers carry sorting on desktop) */}
      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex h-9 shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-medium ${
              sortKey === key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {SORT_LABELS[key]} <SortIcon column={key} />
          </button>
        ))}
      </div>

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
                  onClick={() => toggleSort("volume")}
                >
                  Volume (5m) <SortIcon column="volume" />
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium">
                {budgetNum ? "Affordable qty" : "Buy limit"}
              </th>
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("potentialProfit")}
                >
                  Potential (4h) <SortIcon column="potentialProfit" />
                </button>
              </th>
              <th className="px-3 py-2 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("flipScore")}
                  title="Blends margin, ROI, and volume into one ranking so illiquid outliers don't dominate"
                >
                  Flip score <SortIcon column="flipScore" />
                </button>
              </th>
              {userId && <th className="px-3 py-2 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={userId ? 13 : 12} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                  Loading live GE prices...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={userId ? 13 : 12} className="px-3 py-10 text-center text-destructive">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={userId ? 13 : 12} className="px-3 py-10 text-center text-muted-foreground">
                  No items match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filtered.map((item) => {
                const stale =
                  item.updatedSecondsAgo === null || item.updatedSecondsAgo > STALE_WARN_SECONDS;
                const veryStale =
                  item.updatedSecondsAgo === null || item.updatedSecondsAgo > STALE_BAD_SECONDS;
                const affordableQty = budgetNum
                  ? Math.min(item.buyLimit ?? Infinity, Math.floor(budgetNum / item.buyPrice))
                  : null;
                const affordableProfit =
                  affordableQty !== null && Number.isFinite(affordableQty)
                    ? item.netProfit * affordableQty
                    : item.potentialProfit;

                return (
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
                        {!item.members && (
                          <span className="rounded border border-border px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                            F2P
                          </span>
                        )}
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
                      {formatCompact(item.volume)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 font-tabular text-xs ${
                          veryStale
                            ? "text-destructive"
                            : stale
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                        title={
                          stale
                            ? "This price hasn't traded recently — treat it with caution"
                            : undefined
                        }
                      >
                        {stale && <AlertTriangle className="size-3" />}
                        {formatAge(item.updatedSecondsAgo)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-tabular text-muted-foreground">
                      {budgetNum
                        ? Number.isFinite(affordableQty)
                          ? affordableQty?.toLocaleString("en-US")
                          : "—"
                        : item.buyLimit?.toLocaleString("en-US") ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-tabular font-medium">
                      {formatGp(affordableProfit)}
                    </td>
                    <td className="px-3 py-2 font-tabular text-muted-foreground">
                      {item.flipScore >= 1000
                        ? formatCompact(Math.round(item.flipScore))
                        : Math.round(item.flipScore).toLocaleString("en-US")}
                    </td>
                    {userId && (
                      <td className="px-3 py-2 text-right">
                        <FavouriteButton
                          itemId={item.id}
                          initialFavourited={favouriteIds.has(item.id)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile: compact card list */}
      <div className="md:hidden flex flex-col gap-2">
        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading live GE prices...
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-border py-10 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-lg border border-border py-10 text-center text-sm text-muted-foreground">
            No items match your filters.
          </div>
        )}
        {!loading &&
          !error &&
          filtered.map((item) => {
            const stale =
              item.updatedSecondsAgo === null || item.updatedSecondsAgo > STALE_WARN_SECONDS;
            const veryStale =
              item.updatedSecondsAgo === null || item.updatedSecondsAgo > STALE_BAD_SECONDS;
            const affordableQty = budgetNum
              ? Math.min(item.buyLimit ?? Infinity, Math.floor(budgetNum / item.buyPrice))
              : null;
            const affordableProfit =
              affordableQty !== null && Number.isFinite(affordableQty)
                ? item.netProfit * affordableQty
                : item.potentialProfit;

            return (
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
                    {!item.members && (
                      <span className="shrink-0 rounded border border-border px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                        F2P
                      </span>
                    )}
                  </Link>
                  {userId && (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                      <FavouriteButton
                        itemId={item.id}
                        initialFavourited={favouriteIds.has(item.id)}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
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
                  <div>
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="font-tabular">{formatCompact(item.volume)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Flip score</p>
                    <p className="font-tabular">
                      {item.flipScore >= 1000
                        ? formatCompact(Math.round(item.flipScore))
                        : Math.round(item.flipScore).toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {budgetNum ? "Affordable" : "Buy limit"}
                    </p>
                    <p className="font-tabular">
                      {budgetNum
                        ? Number.isFinite(affordableQty)
                          ? affordableQty?.toLocaleString("en-US")
                          : "—"
                        : item.buyLimit?.toLocaleString("en-US") ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p
                      className={`inline-flex items-center gap-1 font-tabular text-xs ${
                        veryStale ? "text-destructive" : stale ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {stale && <AlertTriangle className="size-3" />}
                      {formatAge(item.updatedSecondsAgo)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">Potential (4h)</span>
                  <span className="font-tabular font-medium">{formatGp(affordableProfit)}</span>
                </div>
              </div>
            );
          })}
      </div>

      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          Showing top {filtered.length} of {items.length.toLocaleString("en-US")} tracked items,
          sorted by {SORT_LABELS[sortKey].toLowerCase()} ({sortDir === "desc" ? "highest first" : "lowest first"}).
          Margins already account for the 2% GE tax (capped at 5m gp/item). Volume is real trades
          in the last 5 minutes, from the OSRS wiki API — treat items showing "no trades" or a
          stale-price warning with caution, since the listed price may not actually be fillable.
        </p>
      )}
    </div>
  );
}
