"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, Trash2, X, Pencil, Check, Undo2, ClipboardList, Search } from "lucide-react";

interface FlipItem {
  id: string;
  itemId: number;
  itemName: string;
  iconUrl: string | null;
  quantity: number;
  buyPrice: number;
  sellPrice: number | null;
  status: "open" | "closed";
  netProfit: number | null;
  roiPercent: number | null;
  notes: string | null;
}

// Keep in sync with IMPORT_NOTES_PREFIX in
// src/app/api/flips/import/route.ts — duplicated here (rather than
// imported) because that file pulls in Prisma/server-only code that
// can't be bundled into a client component.
const IMPORT_NOTES_PREFIX = "Imported from existing inventory";
const RUNELITE_NOTES_PREFIX = "Logged automatically from RuneLite";

function flipSourceBadge(notes: string | null): { label: string; className: string } | null {
  if (!notes) return null;
  if (notes.startsWith(IMPORT_NOTES_PREFIX)) {
    return { label: "Imported", className: "bg-amber-500/10 text-amber-600" };
  }
  if (notes.startsWith(RUNELITE_NOTES_PREFIX)) {
    return { label: "RuneLite", className: "bg-primary/10 text-primary" };
  }
  return null;
}

function formatGp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")} gp`;
}

/** Runs `worker` over `items` with at most `limit` calls in flight at
 * once, preserving the ability for the caller to react to each result
 * as it completes (rather than waiting for the whole batch). Used to
 * parallelize the per-line lookups in the bulk-paste importer instead
 * of awaiting them one at a time. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index], index);
    await next();
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
}

/** Fetches the current market price for an item and returns a single
 * representative gp value (average of instant-buy/instant-sell), or
 * null if no price data is available. Used to (1) pre-fill the
 * estimated price when importing existing holdings, and (2) flag rows
 * whose estimate looks way off from the real market. */
async function fetchMarketPrice(itemId: number): Promise<number | null> {
  try {
    const res = await fetch(`/api/items/${itemId}/price`);
    if (!res.ok) return null;
    const data = await res.json();
    const { high, low } = data as { high: number | null; low: number | null };
    if (high && low) return Math.round((high + low) / 2);
    return high ?? low ?? null;
  } catch {
    return null;
  }
}

/** Returns a short warning string if an estimated price looks
 * suspiciously far from the current market price (more than 2x off in
 * either direction) — usually a typo (missing/extra digit) rather than
 * a real price. */
export function priceWarning(estimatedPrice: number, marketPrice: number | null): string | null {
  if (!marketPrice || !Number.isFinite(estimatedPrice) || estimatedPrice <= 0) return null;
  const ratio = estimatedPrice / marketPrice;
  if (ratio >= 2) {
    return `${ratio.toFixed(1)}x the current price (~${marketPrice.toLocaleString("en-US")} gp) — typo?`;
  }
  if (ratio <= 0.5) {
    return `Only ${(ratio * 100).toFixed(0)}% of the current price (~${marketPrice.toLocaleString("en-US")} gp) — typo?`;
  }
  return null;
}

// Lightweight logging form: reuses the same search flow as the dashboard's
// ItemSearch but resolves a pick into a controlled itemId/name pair instead
// of navigating away, so it can feed the "log a buy" form below.
function LogFlipForm({ onLogged }: { onLogged: () => void }) {
  const [itemId, setItemId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; iconUrl: string | null }[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function submit() {
    const qty = Number(quantity);
    const price = Number(buyPrice.replace(/,/g, ""));
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/flips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: qty, buyPrice: price }),
      });
      if (res.ok) {
        setItemId(null);
        setItemName("");
        setQuery("");
        setQuantity("1");
        setBuyPrice("");
        onLogged();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 mb-6">
      <p className="text-sm font-medium mb-3">Log a buy</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative flex-1 min-w-0">
          {itemId ? (
            <div className="flex h-8 items-center justify-between rounded-lg border border-input px-2.5 text-sm">
              <span className="truncate">{itemName}</span>
              <button onClick={() => { setItemId(null); setItemName(""); }} aria-label="Clear item">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item to log..."
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setItemId(r.id);
                          setItemName(r.name);
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
            </>
          )}
        </div>
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="numeric"
          placeholder="Qty"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:w-20 focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          inputMode="numeric"
          placeholder="Buy price (gp)"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:w-36 focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          onClick={submit}
          disabled={saving || !itemId}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Log
        </button>
      </div>
    </div>
  );
}

interface DraftRow {
  itemId: number;
  itemName: string;
  quantity: string;
  estimatedPrice: string;
  marketPrice: number | null;
  priceLoading: boolean;
}

type ImportResult = { imported: number; skipped: number; unrecognized: number; batchId: string | null };

// Bulk backfill panel: lets a user seed the portfolio with items they
// already hold, without needing the RuneLite plugin. Two entry modes —
// one-by-one search, or pasting a whole list — both build up the same
// draft row list client-side, then submit it in one call to
// /api/flips/import. Session-authenticated (same cookie as the rest of
// the page) — the plugin hits the same endpoint with a Bearer token.
function ImportHoldingsPanel({
  onImported,
  alreadyImportedItemIds,
}: {
  onImported: () => void;
  alreadyImportedItemIds: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; iconUrl: string | null }[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [pasteParsing, setPasteParsing] = useState(false);
  const [pasteSkipped, setPasteSkipped] = useState<string[]>([]);
  const [pasteProgress, setPasteProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

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

  // Point 1: auto-fill the estimated price from the current market price
  // as soon as an item is added, so the user only has to correct it
  // rather than look it up and type it from scratch.
  async function addRow(item: { id: number; name: string }) {
    if (draftRows.some((r) => r.itemId === item.id)) return;
    setDraftRows((rows) => [
      ...rows,
      { itemId: item.id, itemName: item.name, quantity: "", estimatedPrice: "", marketPrice: null, priceLoading: true },
    ]);
    setQuery("");
    setResults([]);

    const price = await fetchMarketPrice(item.id);
    setDraftRows((rows) =>
      rows.map((r) =>
        r.itemId === item.id
          ? { ...r, marketPrice: price, estimatedPrice: price ? String(price) : r.estimatedPrice, priceLoading: false }
          : r
      )
    );
  }

  function updateRow(itemId: number, field: "quantity" | "estimatedPrice", value: string) {
    setDraftRows((rows) => rows.map((r) => (r.itemId === itemId ? { ...r, [field]: value } : r)));
  }

  function removeRow(itemId: number) {
    setDraftRows((rows) => rows.filter((r) => r.itemId !== itemId));
  }

  // Point 2: bulk paste. Expects one item per line, "item name, qty" —
  // resolves each name to an item via the same search endpoint the
  // one-by-one flow uses, taking the top match. Lines that don't
  // resolve to anything are reported back instead of silently dropped.
  async function parsePaste() {
    const lines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setPasteParsing(true);
    setPasteSkipped([]);
    setPasteProgress({ done: 0, total: lines.length });
    const skipped: string[] = [];

    // Resolve each line's item name -> id and market price in parallel
    // (capped concurrency) instead of one sequential round trip per
    // line — a 20-line paste was previously 40+ sequential fetches and
    // could take many seconds; this keeps at most CONCURRENCY requests
    // in flight at once.
    const CONCURRENCY = 5;

    await runWithConcurrency(lines, CONCURRENCY, async (line) => {
      try {
        const [namePart, qtyPart] = line.split(",").map((s) => s.trim());
        if (!namePart) {
          skipped.push(line);
          return;
        }
        const qty = qtyPart ? Number(qtyPart.replace(/,/g, "")) : NaN;

        const res = await fetch(`/api/items/search?q=${encodeURIComponent(namePart)}`);
        if (!res.ok) {
          skipped.push(line);
          return;
        }
        const matches: { id: number; name: string; iconUrl: string | null }[] = await res.json();
        const match = matches[0];
        if (!match) {
          skipped.push(line);
          return;
        }

        // Check-and-add inside the functional updater (not against the
        // `draftRows` closure) so two concurrent lines that resolve to
        // the same item can't both slip past the dedup check.
        let added = false;
        setDraftRows((rows) => {
          if (rows.some((r) => r.itemId === match.id)) return rows;
          added = true;
          return [
            ...rows,
            {
              itemId: match.id,
              itemName: match.name,
              quantity: Number.isFinite(qty) && qty > 0 ? String(qty) : "",
              estimatedPrice: "",
              marketPrice: null,
              priceLoading: true,
            },
          ];
        });
        if (!added) return; // already added by another line in this paste

        const price = await fetchMarketPrice(match.id);
        setDraftRows((rows) =>
          rows.map((r) =>
            r.itemId === match.id
              ? { ...r, marketPrice: price, estimatedPrice: price ? String(price) : r.estimatedPrice, priceLoading: false }
              : r
          )
        );
      } catch {
        // A network hiccup on this one line shouldn't abort the rest of
        // the paste — surface it via the skipped list like any other
        // unresolved line.
        skipped.push(line);
      } finally {
        setPasteProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
      }
    });

    setPasteSkipped(skipped);
    setPasteText("");
    setPasteParsing(false);
    setPasteProgress(null);
  }

  async function submit() {
    setError(null);
    setResult(null);
    setUndone(false);

    const items = draftRows.map((r) => ({
      itemId: r.itemId,
      quantity: Number(r.quantity),
      estimatedPrice: Number(r.estimatedPrice.replace(/,/g, "")),
    }));

    if (
      items.length === 0 ||
      items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0 || !Number.isFinite(i.estimatedPrice) || i.estimatedPrice <= 0)
    ) {
      setError("Fill in a valid quantity and estimated price for every row.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/flips/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong importing these items.");
        return;
      }
      setResult(data);
      setDraftRows([]);
      onImported();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Point 5: undo the whole batch in one action instead of deleting
  // rows one at a time in the table below.
  async function undoImport() {
    if (!result?.batchId) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/flips/import/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: result.batchId }),
      });
      if (res.ok) {
        setUndone(true);
        onImported();
      }
    } finally {
      setUndoing(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 text-sm text-primary underline underline-offset-2"
      >
        Import existing holdings
      </button>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Import existing holdings</p>
          <p className="text-xs text-muted-foreground">
            Add items you already own. Price is pre-filled from the current market — adjust it if you
            remember what you actually paid.
          </p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setMode("search")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === "search" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Search className="h-3 w-3" /> Search
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === "paste" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <ClipboardList className="h-3 w-3" /> Paste list
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item to add..."
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
              {results.map((r) => {
                // Point 6: grey out / label items that already have an
                // open imported flip, instead of letting the user add
                // them and only finding out after submit that they
                // were skipped as duplicates.
                const isAlreadyImported = alreadyImportedItemIds.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => !isAlreadyImported && addRow(r)}
                      disabled={isAlreadyImported}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        {r.iconUrl && <Image src={r.iconUrl} alt="" width={18} height={18} />}
                        {r.name}
                      </span>
                      {isAlreadyImported && (
                        <span className="text-[10px] text-muted-foreground">Already imported</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="mb-3 space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"One item per line: item name, quantity\ne.g.\nAbyssal whip, 1\nRune arrow, 2000"}
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            onClick={parsePaste}
            disabled={pasteParsing || pasteText.trim().length === 0}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium disabled:opacity-50"
          >
            {pasteParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
            {pasteParsing && pasteProgress ? `Parsing ${pasteProgress.done}/${pasteProgress.total}…` : "Parse list"}
          </button>
          {pasteSkipped.length > 0 && (
            <p className="text-xs text-destructive">
              Couldn&apos;t match: {pasteSkipped.join("; ")}
            </p>
          )}
        </div>
      )}

      {draftRows.length > 0 && (
        <div className="space-y-2 mb-3">
          {draftRows.map((row) => {
            // Point 4: flag rows whose price looks like a typo relative
            // to the current market price.
            const warning = priceWarning(Number(row.estimatedPrice.replace(/,/g, "")), row.marketPrice);
            return (
              <div key={row.itemId}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="flex-1 min-w-0 truncate text-sm">{row.itemName}</span>
                  <input
                    value={row.quantity}
                    onChange={(e) => updateRow(row.itemId, "quantity", e.target.value)}
                    inputMode="numeric"
                    placeholder="Qty"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:w-20 focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <div className="relative w-full sm:w-36">
                    <input
                      value={row.estimatedPrice}
                      onChange={(e) => updateRow(row.itemId, "estimatedPrice", e.target.value)}
                      inputMode="numeric"
                      placeholder={row.priceLoading ? "Loading price…" : "Est. price (gp)"}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    {row.priceLoading && (
                      <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <button onClick={() => removeRow(row.itemId)} aria-label="Remove row">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
                {warning && <p className="mt-1 text-xs text-amber-600">⚠ {warning}</p>}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      {result && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Imported {result.imported}
            {result.skipped > 0 ? `, skipped ${result.skipped} (already imported)` : ""}
            {result.unrecognized > 0 ? `, ${result.unrecognized} not recognized` : ""}.
          </p>
          {result.batchId && !undone && (
            <button
              onClick={undoImport}
              disabled={undoing}
              className="flex items-center gap-1 text-xs text-destructive underline underline-offset-2 disabled:opacity-50"
            >
              {undoing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
              Undo this import
            </button>
          )}
          {undone && <span className="text-xs text-muted-foreground">Undone.</span>}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting || draftRows.length === 0}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Import {draftRows.length > 0 ? `(${draftRows.length})` : ""}
      </button>
    </div>
  );
}

export function PortfolioTable() {
  const [flips, setFlips] = useState<FlipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [sellDrafts, setSellDrafts] = useState<Record<string, string>>({});

  // Point 3: inline edit for open flips (mainly for imported rows,
  // where buyPrice starts out as an estimate that may need correcting).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, { quantity: string; buyPrice: string }>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/flips");
    if (res.ok) setFlips(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function closeFlip(id: string) {
    const sellPrice = Number((sellDrafts[id] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) return;
    setClosingId(id);
    await fetch(`/api/flips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellPrice }),
    });
    setClosingId(null);
    load();
  }

  async function removeFlip(id: string) {
    await fetch(`/api/flips/${id}`, { method: "DELETE" });
    setFlips((prev) => prev.filter((f) => f.id !== id));
  }

  function startEdit(f: FlipItem) {
    setEditingId(f.id);
    setEditDrafts((d) => ({ ...d, [f.id]: { quantity: String(f.quantity), buyPrice: String(f.buyPrice) } }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const draft = editDrafts[id];
    if (!draft) return;
    const quantity = Number(draft.quantity);
    const buyPrice = Number(draft.buyPrice.replace(/,/g, ""));
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) return;

    setSavingEditId(id);
    try {
      const res = await fetch(`/api/flips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, buyPrice }),
      });
      if (res.ok) {
        setEditingId(null);
        load();
      }
    } finally {
      setSavingEditId(null);
    }
  }

  const open = flips.filter((f) => f.status === "open");
  const closed = flips.filter((f) => f.status === "closed");
  const realizedTotal = closed.reduce((sum, f) => sum + (f.netProfit ?? 0), 0);

  // Point 6 data source: item ids that already have an open, imported
  // flip, so the import panel's search results can grey them out.
  const alreadyImportedItemIds = useMemo(
    () =>
      new Set(
        open.filter((f) => f.notes?.startsWith(IMPORT_NOTES_PREFIX)).map((f) => f.itemId)
      ),
    [open]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading portfolio...
      </div>
    );
  }

  return (
    <div>
      <div id="log-a-buy">
        <LogFlipForm onLogged={load} />
      </div>
      <ImportHoldingsPanel onImported={load} alreadyImportedItemIds={alreadyImportedItemIds} />

      {/* Mobile: floating shortcut back to the log-a-buy form, so it's
          reachable without scrolling to the top after browsing flips */}
      <button
        onClick={() =>
          document.getElementById("log-a-buy")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        aria-label="Log a buy"
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <div className="mb-6 border rounded-lg p-4">
        <p className="text-xs text-muted-foreground">Realized profit (all closed flips)</p>
        <p className={`text-2xl font-semibold ${realizedTotal >= 0 ? "text-primary" : "text-destructive"}`}>
          {formatGp(realizedTotal)}
        </p>
      </div>

      <h2 className="font-display text-lg mb-2">Open positions ({open.length})</h2>
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No open flips — log a buy above.</p>
      ) : (
        <div className="mb-8">
          {/* Desktop/tablet: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Buy price</th>
                  <th className="py-2 pr-3 font-medium">Sell price to close</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {open.map((f) => {
                  const isEditing = editingId === f.id;
                  const draft = editDrafts[f.id];
                  return (
                    <tr key={f.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <Link href={`/item/${f.itemId}`} className="flex items-center gap-2 hover:underline">
                          {f.iconUrl && <Image src={f.iconUrl} alt="" width={20} height={20} />}
                          {f.itemName}
                          {(() => {
                            const badge = flipSourceBadge(f.notes);
                            return badge ? (
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : null;
                          })()}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            value={draft?.quantity ?? ""}
                            onChange={(e) =>
                              setEditDrafts((d) => ({ ...d, [f.id]: { ...d[f.id], quantity: e.target.value } }))
                            }
                            inputMode="numeric"
                            className="h-8 w-20 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        ) : (
                          f.quantity
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            value={draft?.buyPrice ?? ""}
                            onChange={(e) =>
                              setEditDrafts((d) => ({ ...d, [f.id]: { ...d[f.id], buyPrice: e.target.value } }))
                            }
                            inputMode="numeric"
                            className="h-8 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        ) : (
                          formatGp(f.buyPrice)
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={sellDrafts[f.id] ?? ""}
                          onChange={(e) => setSellDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                          inputMode="numeric"
                          placeholder="Sell price"
                          disabled={isEditing}
                          className="h-8 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(f.id)}
                                disabled={savingEditId === f.id}
                                aria-label="Save edit"
                                className="flex h-8 items-center gap-1 rounded-lg bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                              >
                                {savingEditId === f.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button onClick={cancelEdit} aria-label="Cancel edit" className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => closeFlip(f.id)}
                                disabled={closingId === f.id}
                                className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                              >
                                Close
                              </button>
                              <button onClick={() => startEdit(f)} aria-label="Edit flip" className="text-muted-foreground hover:text-foreground">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => removeFlip(f.id)} aria-label="Delete flip" className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {open.map((f) => {
              const isEditing = editingId === f.id;
              const draft = editDrafts[f.id];
              const badge = flipSourceBadge(f.notes);
              return (
                <div key={f.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Link href={`/item/${f.itemId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      {f.iconUrl && <Image src={f.iconUrl} alt="" width={24} height={24} />}
                      <span className="truncate font-medium">{f.itemName}</span>
                      {badge && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(f.id)}
                            disabled={savingEditId === f.id}
                            aria-label="Save edit"
                            className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            {savingEditId === f.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button onClick={cancelEdit} aria-label="Cancel edit" className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(f)} aria-label="Edit flip" className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button onClick={() => removeFlip(f.id)} aria-label="Delete flip" className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Qty</p>
                      {isEditing ? (
                        <input
                          value={draft?.quantity ?? ""}
                          onChange={(e) =>
                            setEditDrafts((d) => ({ ...d, [f.id]: { ...d[f.id], quantity: e.target.value } }))
                          }
                          inputMode="numeric"
                          className="mt-0.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      ) : (
                        <p>{f.quantity}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Buy price</p>
                      {isEditing ? (
                        <input
                          value={draft?.buyPrice ?? ""}
                          onChange={(e) =>
                            setEditDrafts((d) => ({ ...d, [f.id]: { ...d[f.id], buyPrice: e.target.value } }))
                          }
                          inputMode="numeric"
                          className="mt-0.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      ) : (
                        <p>{formatGp(f.buyPrice)}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Sell price to close</p>
                      <input
                        value={sellDrafts[f.id] ?? ""}
                        onChange={(e) => setSellDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                        inputMode="numeric"
                        placeholder="Sell price"
                        disabled={isEditing}
                        className="mt-0.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {!isEditing && (
                    <button
                      onClick={() => closeFlip(f.id)}
                      disabled={closingId === f.id}
                      className="mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {closingId === f.id ? "Closing..." : "Close flip"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="font-display text-lg mb-2">Closed flips ({closed.length})</h2>
      {closed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Closed flips will show their realized P&amp;L here.</p>
      ) : (
        <>
          {/* Desktop/tablet: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Buy</th>
                  <th className="py-2 pr-3 font-medium">Sell</th>
                  <th className="py-2 pr-3 font-medium">Net profit</th>
                  <th className="py-2 pr-3 font-medium">ROI</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {closed.map((f) => (
                  <tr key={f.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <Link href={`/item/${f.itemId}`} className="flex items-center gap-2 hover:underline">
                        {f.iconUrl && <Image src={f.iconUrl} alt="" width={20} height={20} />}
                        {f.itemName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{f.quantity}</td>
                    <td className="py-2 pr-3">{formatGp(f.buyPrice)}</td>
                    <td className="py-2 pr-3">{formatGp(f.sellPrice)}</td>
                    <td className={`py-2 pr-3 font-medium ${(f.netProfit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatGp(f.netProfit)}
                    </td>
                    <td className="py-2 pr-3">{f.roiPercent !== null ? `${f.roiPercent.toFixed(2)}%` : "—"}</td>
                    <td className="py-2 pr-3">
                      <button onClick={() => removeFlip(f.id)} aria-label="Delete flip" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {closed.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Link href={`/item/${f.itemId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    {f.iconUrl && <Image src={f.iconUrl} alt="" width={24} height={24} />}
                    <span className="truncate font-medium">{f.itemName}</span>
                  </Link>
                  <button
                    onClick={() => removeFlip(f.id)}
                    aria-label="Delete flip"
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <p>{f.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p>{f.roiPercent !== null ? `${f.roiPercent.toFixed(2)}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buy</p>
                    <p>{formatGp(f.buyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sell</p>
                    <p>{formatGp(f.sellPrice)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Net profit</p>
                    <p className={`font-medium ${(f.netProfit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatGp(f.netProfit)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
