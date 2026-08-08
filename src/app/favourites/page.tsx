import { createClient } from "@/lib/supabase/server";
import { WatchlistTable } from "@/components/WatchlistTable";
import Link from "next/link";

export default async function FavouritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-10 max-w-5xl mx-auto sm:px-10">
        <p className="text-muted-foreground">
          <Link href="/login" className="text-primary underline">Sign in</Link> to save favourites.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-6 sm:px-10 sm:py-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">Favourites</h1>
        <p className="text-sm text-muted-foreground">
          Live buy/sell prices and tax-adjusted margins for everything you&apos;ve starred.
        </p>
      </header>
      <WatchlistTable />
    </div>
  );
}