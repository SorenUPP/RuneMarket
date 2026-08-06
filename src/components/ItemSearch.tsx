"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import Image from "next/image";

interface SearchResult {
  id: number;
  name: string;
  iconUrl: string | null;
}

export function ItemSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const showDropdown = focused && query.length >= 2;

  return (
    <Command
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="w-full max-w-xl rounded-2xl border border-border/60 bg-card/90
        backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]
        transition-all duration-300 ease-out
        focus-within:shadow-[0_8px_30px_rgba(169,120,78,0.12)]
        focus-within:border-primary/50
        focus-within:ring-4 focus-within:ring-primary/10"
    >
      <CommandInput
        placeholder="Search items (e.g. Abyssal whip)..."
        value={query}
        onValueChange={setQuery}
        className="text-[15px] placeholder:text-muted-foreground/70"
        wrapperClassName="h-11! rounded-xl! border-transparent! bg-muted/50"
      />
      <CommandList
        className={`transition-all duration-200 ease-out ${
          showDropdown
            ? "opacity-100 translate-y-0 max-h-80 mt-1"
            : "opacity-0 -translate-y-1 max-h-0 mt-0 pointer-events-none"
        }`}
      >
        {!loading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty className="py-8 text-sm text-muted-foreground/80">
            No items found.
          </CommandEmpty>
        )}
        {results.map((item) => (
          <CommandItem
            key={item.id}
            value={item.name}
            onSelect={() => router.push(`/item/${item.id}`)}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5
              transition-colors duration-150 data-selected:bg-primary/8"
          >
            {item.iconUrl ? (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                <Image
                  src={item.iconUrl}
                  alt={item.name}
                  width={22}
                  height={22}
                />
              </div>
            ) : (
              <div className="size-8 shrink-0 rounded-lg bg-muted/70" />
            )}
            <span className="text-sm font-medium">{item.name}</span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}