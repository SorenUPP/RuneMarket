"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AlertButton({ itemId, itemName }: { itemId: number; itemName: string }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [priceType, setPriceType] = useState<"high" | "low">("low");
  const [targetPrice, setTargetPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function createAlert() {
    const price = Number(targetPrice.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) {
      setStatus("error");
      return;
    }
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, direction, priceType, targetPrice: price }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTargetPrice("");
      setTimeout(() => setOpen(false), 700);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        aria-label="Set a price alert"
        className="rounded-md p-2 border border-border text-muted-foreground transition-all duration-150 hover:text-foreground hover:border-primary/40 active:scale-90"
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alert me for {itemName}</DialogTitle>
          <DialogDescription>
            We&apos;ll flag this item next time the price crosses your target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "above" | "below")}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="below">Drops below</option>
              <option value="above">Rises above</option>
            </select>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as "high" | "low")}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="low">Instant sell price</option>
              <option value="high">Instant buy price</option>
            </select>
          </div>

          <Input
            inputMode="numeric"
            placeholder="Target price (gp)"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
          />

          {status === "error" && (
            <p className="text-xs text-destructive">Enter a valid target price.</p>
          )}
          {status === "saved" && (
            <p className="text-xs text-primary">Alert saved — check your Profile page.</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={createAlert} disabled={saving}>
            {saving ? "Saving..." : "Create alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
