import { ItemCompare } from "@/components/ItemCompare";

export const metadata = {
  title: "Compare — RuneMarket",
  description: "Compare margin, volume, and volatility across items side by side",
};

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">Compare Items</h1>
        <p className="text-sm text-muted-foreground">
          Line up tax-adjusted margin, ROI, trade volume, and volatility across a handful of
          items to decide what to flip next.
        </p>
      </header>

      <ItemCompare />
    </div>
  );
}
