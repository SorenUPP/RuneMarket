
import { ItemSearch } from "@/components/ItemSearch";
import { TrendingCard } from "@/components/TrendingCard";

async function getTrending() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/items/trending`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  return res.json();
}

export default async function Home() {
  const trending = await getTrending();

  return (
    <div className="px-10 py-10 max-w-5xl mx-auto space-y-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">RuneMarket</h1>
        <p className="text-sm text-muted-foreground">
          Live Grand Exchange prices and trends
        </p>
      </header>

      <ItemSearch />

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-foreground">
            Trending
          </h2>
          <span className="text-xs text-muted-foreground font-tabular">
            {trending.length} items
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {trending.map((item: any) => (
            <TrendingCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}