"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, Trash2, X } from "lucide-react";

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

function formatGp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString()} gp`;
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

export function PortfolioTable() {
  const [flips, setFlips] = useState<FlipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [sellDrafts, setSellDrafts] = useState<Record<string, string>>({});

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

  const open = flips.filter((f) => f.status === "open");
  const closed = flips.filter((f) => f.status === "closed");
  const realizedTotal = closed.reduce((sum, f) => sum + (f.netProfit ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading portfolio...
      </div>
    );
  }

  return (
    <div>
      <LogFlipForm onLogged={load} />

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
        <div className="overflow-x-auto mb-8">
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
              {open.map((f) => (
                <tr key={f.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <Link href={`/item/${f.itemId}`} className="flex items-center gap-2 hover:underline">
                      {f.iconUrl && <Image src={f.iconUrl} alt="" width={20} height={20} />}
                      {f.itemName}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{f.quantity}</td>
                  <td className="py-2 pr-3">{formatGp(f.buyPrice)}</td>
                  <td className="py-2 pr-3">
                    <input
                      value={sellDrafts[f.id] ?? ""}
                      onChange={(e) => setSellDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                      inputMode="numeric"
                      placeholder="Sell price"
                      className="h-8 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </td>
                  <td className="py-2 pr-3 flex items-center gap-2">
                    <button
                      onClick={() => closeFlip(f.id)}
                      disabled={closingId === f.id}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Close
                    </button>
                    <button onClick={() => removeFlip(f.id)} aria-label="Delete flip" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-display text-lg mb-2">Closed flips ({closed.length})</h2>
      {closed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Closed flips will show their realized P&amp;L here.</p>
      ) : (
        <div className="overflow-x-auto">
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
      )}
    </div>
  );
}
