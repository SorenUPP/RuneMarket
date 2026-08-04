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

  return (
    <Command className="rounded-lg border border-border bg-card shadow-sm w-full max-w-xl">
      <CommandInput
        placeholder="Search items (e.g. Abyssal whip)..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!loading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>No items found.</CommandEmpty>
        )}
        {results.map((item) => (
          <CommandItem
            key={item.id}
            value={item.name}
            onSelect={() => router.push(`/item/${item.id}`)}
            className="flex items-center gap-2 cursor-pointer"
          >
            {item.iconUrl && (
              <Image
                src={item.iconUrl}
                alt={item.name}
                width={24}
                height={24}
              />
            )}
            <span>{item.name}</span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}