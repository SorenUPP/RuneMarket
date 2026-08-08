import { TaxCalculator } from "@/components/TaxCalculator";
import { MarginScreener } from "@/components/MarginScreener";

export const metadata = {
  title: "Margin Finder — RuneMarket",
  description: "Tax-adjusted margins, ROI, and flip potential across the Grand Exchange",
};

export default function ScreenerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">Margin Finder</h1>
        <p className="text-sm text-muted-foreground">
          Live buy/sell prices, tax-adjusted margins, and ROI across every tracked item — now
          with real trade volume, staleness warnings, and a capital-aware flip screener.
        </p>
      </header>

      <TaxCalculator />

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">High-Margin Screener</h2>
        <MarginScreener />
      </section>
    </div>
  );
}
