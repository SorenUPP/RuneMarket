import { ItemSearch } from "@/components/ItemSearch";
import { TrendingMarquee } from "@/components/TrendingMarquee";

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
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <header className="space-y-1 text-center">
          <h1 className="font-display text-4xl text-foreground">RuneMarket</h1>
          <p className="text-sm text-muted-foreground">
            Live Grand Exchange prices and trends
          </p>
        </header>

        <div className="w-full max-w-xl">
          <ItemSearch />
        </div>
      </div>

      <div className="pb-16">
        <TrendingMarquee items={trending} />
      </div>
    </div>
  );
}
