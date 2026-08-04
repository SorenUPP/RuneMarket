import Link from "next/link";
import Image from "next/image";

interface TrendingItem {
  id: number;
  name: string;
  iconUrl: string | null;
  high: number | null;
  low: number | null;
}

export function TrendingCard({ item }: { item: TrendingItem }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="group border border-border bg-card rounded-lg p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      {item.iconUrl && (
        <div className="shrink-0 rounded-md bg-secondary p-1.5">
          <Image src={item.iconUrl} alt={item.name} width={28} height={28} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {item.name}
        </p>
        <p className="text-sm text-muted-foreground font-tabular">
          {item.high?.toLocaleString() ?? "—"} gp
        </p>
      </div>
    </Link>
  );
}