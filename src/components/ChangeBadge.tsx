
import { ArrowUp, ArrowDown } from "lucide-react";

export function ChangeBadge({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null) {
    return (
      <div className="border border-border bg-card rounded-lg p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground font-tabular">—</p>
      </div>
    );
  }

  const isPositive = value >= 0;
  return (
    <div className="border border-border bg-card rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`flex items-center gap-1 text-lg font-semibold font-tabular ${
          isPositive ? "text-[#4B7A52]" : "text-[#B5453A]"
        }`}
      >
        {isPositive ? (
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <ArrowDown className="h-4 w-4" strokeWidth={2.5} />
        )}
        {isPositive ? "+" : ""}
        {value.toFixed(1)}%
      </p>
    </div>
  );
}