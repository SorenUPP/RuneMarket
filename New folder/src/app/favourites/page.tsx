import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { TrendingCard } from "@/components/TrendingCard";
import Link from "next/link";

export default async function FavouritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-10 py-10 max-w-5xl mx-auto">
        <p className="text-muted-foreground">
          <Link href="/login" className="text-primary underline">Sign in</Link> to save favourites.
        </p>
      </div>
    );
  }

  const favourites = await prisma.favourite.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-10 py-10 max-w-5xl mx-auto space-y-6">
      <h1 className="font-display text-3xl text-foreground">Favourites</h1>
      {favourites.length === 0 ? (
        <p className="text-muted-foreground">No favourites yet — star an item to save it here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favourites.map((f: { item: { id: number; name: string; iconUrl: string | null } }) => (
            <TrendingCard
              key={f.item.id}
              item={{ id: f.item.id, name: f.item.name, iconUrl: f.item.iconUrl, high: null, low: null }}
            />
          ))}
        </div>
      )}
    </div>
  );
}