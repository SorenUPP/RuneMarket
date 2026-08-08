"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calculator } from "lucide-react";
import { TopRightControls } from "@/components/TopRightControls";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/screener", label: "Margin Finder", icon: Calculator },
];

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-sidebar-border bg-sidebar">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link
            href="/"
            className="shrink-0 font-display text-base text-sidebar-foreground tracking-tight whitespace-nowrap sm:text-lg"
          >
            RuneMarket
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors sm:px-3 ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="hidden whitespace-nowrap sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <TopRightControls />
      </div>
    </header>
  );
}
