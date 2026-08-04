"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function FavouriteButton({
  itemId,
  initialFavourited,
}: {
  itemId: number;
  initialFavourited: boolean;
}) {
  const [favourited, setFavourited] = useState(initialFavourited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    if (favourited) {
      await fetch(`/api/favourites/${itemId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/favourites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
    }
    setFavourited(!favourited);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={favourited ? "Remove from favourites" : "Add to favourites"}
      className={`rounded-md p-2 border transition-colors ${
        favourited
          ? "bg-primary/10 border-primary text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      <Star className="h-5 w-5" fill={favourited ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}