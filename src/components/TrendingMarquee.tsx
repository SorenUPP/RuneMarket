"use client";

import { useState } from "react";
import { TrendingCard } from "@/components/TrendingCard";

interface TrendingItem {
  id: number;
  name: string;
  iconUrl: string | null;
  high: number | null;
  low: number | null;
}

export function TrendingMarquee({ items }: { items: TrendingItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No price data available right now.
      </p>
    );
  }

  // Duplicate the list so the strip can loop seamlessly.
  const track = [...items, ...items];

  // group-hover doesn't fire on touch devices, so track touch/press state
  // explicitly to pause the marquee while someone's finger is on it.
  const [touchPaused, setTouchPaused] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-center gap-2">
        <h2 className="font-display text-xl text-foreground">Highest Selling Items</h2>
        <span className="text-xs text-muted-foreground font-tabular">
          top {items.length}
        </span>
      </div>

      <div
        className="group/marquee relative w-full overflow-hidden
          [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        onTouchStart={() => setTouchPaused(true)}
        onTouchEnd={() => setTouchPaused(false)}
        onTouchCancel={() => setTouchPaused(false)}
      >
        <div
          className="flex w-max animate-marquee gap-3 group-hover/marquee:[animation-play-state:paused]"
          style={touchPaused ? { animationPlayState: "paused" } : undefined}
        >
          {track.map((item, i) => (
            <div key={`${item.id}-${i}`} className="w-64 shrink-0">
              <TrendingCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
