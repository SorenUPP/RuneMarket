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
        No trending items right now.
      </p>
    );
  }

  // Duplicate the list so the strip can loop seamlessly.
  const track = [...items, ...items];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-center gap-2">
        <h2 className="font-display text-xl text-foreground">Trending</h2>
        <span className="text-xs text-muted-foreground font-tabular">
          {items.length} items
        </span>
      </div>

      <div
        className="group/marquee relative w-full overflow-hidden
          [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
      >
        <div className="flex w-max animate-marquee gap-3 group-hover/marquee:[animation-play-state:paused]">
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
