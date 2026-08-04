import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { PriceChart } from "@/components/PriceChart";
import { ChangeBadge } from "@/components/ChangeBadge";
import { FavouriteButton } from "@/components/FavouriteButton";
import { createClient } from "@/lib/supabase/server";

async function getPrice(itemId: number) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/items/${itemId}/price`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

async function getStats(itemId: number) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/items/${itemId}/stats`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const itemId = Number(id);

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) notFound();

  const [price, stats] = await Promise.all([getPrice(itemId), getStats(itemId)]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isFavourited = false;
  if (user) {
  const fav = await prisma.favourite.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  });
  isFavourited = !!fav;
}

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-6">
        {item.iconUrl && (
          <Image src={item.iconUrl} alt={item.name} width={48} height={48} />
        )}
        <h1 className="font-display text-3xl text-foreground flex-1">{item.name}</h1>
        {user && <FavouriteButton itemId={itemId} initialFavourited={isFavourited} />}
      </div>

      {price ? (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Instant Buy</p>
            <p className="text-2xl font-semibold">
              {price.high?.toLocaleString() ?? "—"} gp
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Instant Sell</p>
            <p className="text-2xl font-semibold">
              {price.low?.toLocaleString() ?? "—"} gp
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground mb-4">No price data available.</p>
      )}

      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          <ChangeBadge label="24h" value={stats.change24h} />
          <ChangeBadge label="7d" value={stats.change7d} />
          <ChangeBadge label="30d" value={stats.change30d} />
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">24h Volume</p>
            <p className="text-lg font-semibold">
              {stats.volume24h?.toLocaleString() ?? "—"}
            </p>
          </div>
        </div>
      )}

      <PriceChart itemId={itemId} />
    </main>
  );
}