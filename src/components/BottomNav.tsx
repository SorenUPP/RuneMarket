"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calculator, Wallet, Menu, Search } from "lucide-react";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/screener", label: "Margin", icon: Calculator },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href;
}

/**
 * Fixed bottom tab bar shown on small screens only. Faster to reach
 * one-handed than the hamburger drawer in Topbar, which it complements
 * rather than replaces — "More" opens the same mobile sheet menu, and
 * the search tab opens the same command palette used elsewhere.
 */
export function BottomNav({
  onOpenMenu,
  onOpenSearch,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              active ? "text-primary" : "text-sidebar-foreground/60"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            {label}
          </Link>
        );
      })}

      <button
        onClick={onOpenSearch}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/60"
      >
        <Search className="h-5 w-5" strokeWidth={2} />
        Search
      </button>

      <button
        onClick={onOpenMenu}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/60"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
        More
      </button>
    </nav>
  );
}
