import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PortfolioTable } from "@/components/PortfolioTable";

export const metadata = {
  title: "Portfolio — RuneMarket",
  description: "Track logged flips and realized profit, with GE tax applied automatically",
};

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
        <Link href="/" className="hover:text-foreground hover:underline">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span className="text-foreground/80">Portfolio</span>
      </nav>

      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Log your buys, close them out with a sell price, and see net profit after GE tax —
          calculated the same way as the Margin Finder.
        </p>
      </header>

      {user ? (
        <PortfolioTable />
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline">
            Sign in
          </Link>{" "}
          to start tracking flips.
        </p>
      )}
    </div>
  );
}
