"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
];

export function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);

  const onAccount = pathname.startsWith("/login") || pathname.startsWith("/profile");

  useEffect(() => {
    if (onAccount) setCollapsed(true);
  }, [onAccount]);

  useEffect(() => {
    setNarrow(collapsed);
  }, [collapsed]);

  return (
    <aside
      className={`shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col
        transition-[width] duration-300 ease-in-out overflow-hidden
        ${narrow ? "w-[76px]" : "w-60"}`}
    >
      <div className="flex items-center justify-between px-4 py-6">
        <span
          className={`font-display text-xl text-sidebar-foreground tracking-tight whitespace-nowrap
            transition-opacity duration-200 ${narrow ? "opacity-0 w-0 pointer-events-none" : "opacity-100"}`}
        >
          RuneMarket
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {narrow ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              {active && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-r-sm bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  narrow ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}