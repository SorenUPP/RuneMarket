"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Star } from "lucide-react";

interface FavouriteItem {
  id: number;
  name: string;
  iconUrl: string | null;
}

export const FAVOURITES_CHANGED_EVENT = "favourites:changed";

export function FavouritesDrawer({
  open,
  onClose,
  isSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  isSignedIn: boolean;
}) {
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/favourites");
      if (res.ok) {
        setItems(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    function handleChanged() {
      if (open) load();
    }
    window.addEventListener(FAVOURITES_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(FAVOURITES_CHANGED_EVENT, handleChanged);
  }, [open, load]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ease-in-out ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-card border-l border-border shadow-xl
          flex flex-col transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" fill="currentColor" />
            <h2 className="font-display text-lg text-foreground">Favourites</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90"
            aria-label="Close favourites"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {!isSignedIn ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline" onClick={onClose}>
                Sign in
              </Link>{" "}
              to save favourites.
            </p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No favourites yet — star an item to save it here.
            </p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/item/${item.id}`}
                onClick={onClose}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 hover:border-primary/40 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                {item.iconUrl && (
                  <div className="shrink-0 rounded-md bg-secondary p-1.5">
                    <Image src={item.iconUrl} alt={item.name} width={24} height={24} />
                  </div>
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {item.name}
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
