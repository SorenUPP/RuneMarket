"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { FavouritesDrawer } from "@/components/FavouritesDrawer";

export function TopRightControls() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const initial = user?.user_metadata?.display_name?.[0] ?? user?.email?.[0] ?? null;

  return (
    <>
      <div className="fixed top-5 right-5 z-30 flex items-center gap-2">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open favourites"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm
            transition-all duration-150 ease-out hover:text-primary hover:border-primary/40 hover:shadow-md
            active:scale-90"
        >
          <Star className="h-4.5 w-4.5" strokeWidth={2} />
        </button>

        <button
          onClick={() => router.push(user ? "/profile" : "/login")}
          aria-label={user ? "Go to account" : "Log in"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-sm
            font-display text-sm uppercase transition-all duration-150 ease-out hover:shadow-md hover:brightness-105
            active:scale-90"
        >
          {initial ? initial : <span className="text-base leading-none">🙂</span>}
        </button>
      </div>

      <FavouritesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isSignedIn={!!user}
      />
    </>
  );
}
