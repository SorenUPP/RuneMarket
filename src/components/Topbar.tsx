"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutGrid,
  Calculator,
  Wallet,
  Scale,
  Star,
  Bell,
  ChevronDown,
  Menu,
  X,
  Search,
  Loader2,
} from "lucide-react";
import { TopRightControls } from "@/components/TopRightControls";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const PRIMARY_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/screener", label: "Margin Finder", icon: Calculator },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

const TOOLS_ITEMS = [
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/favourites", label: "Favourites", icon: Star },
  { href: "/profile#alerts", label: "Alerts", icon: Bell },
];

const ALL_ITEMS = [...PRIMARY_ITEMS, ...TOOLS_ITEMS];
const RECENT_TOOL_KEY = "runemarket:recent-tool";
// Nav hrefs that should show a "New" badge until the user visits them once.
const NEW_ITEM_HREFS = ["/compare", "/profile#alerts"];
const SEEN_NEW_KEY = "runemarket:seen-new-nav";

interface AlertItem {
  id: string;
  itemId: number;
  itemName: string;
  direction: "above" | "below";
  priceType: "high" | "low";
  targetPrice: number;
  triggered: boolean;
  triggeredAt: string | null;
}

interface ItemSearchResult {
  id: number;
  name: string;
  iconUrl: string | null;
}

function isActive(pathname: string, href: string) {
  const base = href.split("#")[0];
  if (base === "/") return pathname === "/";
  return pathname === base;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [recentTool, setRecentTool] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [seenNew, setSeenNew] = useState<string[]>([]);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [itemResults, setItemResults] = useState<ItemSearchResult[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);

  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const firstToolsItemRef = useRef<HTMLAnchorElement>(null);
  const firstMobileItemRef = useRef<HTMLAnchorElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const pendingKeyRef = useRef<string | null>(null);

  const activeTool = TOOLS_ITEMS.find((item) => isActive(pathname, item.href));
  const toolsActive = !!activeTool;
  const triggeredAlerts = alerts.filter((a) => a.triggered);
  const triggeredCount = triggeredAlerts.length;

  // Load recently-used tool + seen "New" badges from localStorage
  useEffect(() => {
    const storedTool = window.localStorage.getItem(RECENT_TOOL_KEY);
    if (storedTool) setRecentTool(storedTool);
    const storedSeen = window.localStorage.getItem(SEEN_NEW_KEY);
    if (storedSeen) setSeenNew(JSON.parse(storedSeen));
  }, []);

  // Persist recently-used tool + mark "New" badges as seen whenever a route becomes active
  useEffect(() => {
    if (activeTool) {
      window.localStorage.setItem(RECENT_TOOL_KEY, activeTool.href);
      setRecentTool(activeTool.href);
    }
    const matchingNew = NEW_ITEM_HREFS.find((href) => isActive(pathname, href));
    if (matchingNew) {
      setSeenNew((prev) => {
        if (prev.includes(matchingNew)) return prev;
        const next = [...prev, matchingNew];
        window.localStorage.setItem(SEEN_NEW_KEY, JSON.stringify(next));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fetch alerts (for both the notification badge and the notification popover)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AlertItem[]) => {
        if (!cancelled) setAlerts(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Debounced item search for the command palette
  useEffect(() => {
    if (paletteQuery.trim().length < 2) {
      setItemResults([]);
      return;
    }
    setItemSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items/search?q=${encodeURIComponent(paletteQuery)}`);
        setItemResults(res.ok ? await res.json() : []);
      } catch {
        setItemResults([]);
      } finally {
        setItemSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [paletteQuery]);

  // Close dropdown / notification popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close everything on route change
  useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
    setPaletteOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // Escape closes whichever overlay is open, and returns focus.
  // Also handles Cmd/Ctrl+K and the "g then d/p/c" shortcut pair.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        if (toolsOpen) {
          setToolsOpen(false);
          toolsButtonRef.current?.focus();
        }
        if (mobileOpen) {
          setMobileOpen(false);
          mobileButtonRef.current?.focus();
        }
        if (notifOpen) {
          setNotifOpen(false);
          notifButtonRef.current?.focus();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      if (typing) return;

      // "g" then a second key jumps to a page, GitHub-style
      if (pendingKeyRef.current === "g") {
        pendingKeyRef.current = null;
        const map: Record<string, string> = {
          d: "/",
          p: "/portfolio",
          c: "/compare",
          m: "/screener",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        pendingKeyRef.current = "g";
        setTimeout(() => {
          pendingKeyRef.current = null;
        }, 800);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toolsOpen, mobileOpen, notifOpen, router]);

  // Focus first item when dropdown/mobile menu opens
  useEffect(() => {
    if (toolsOpen) firstToolsItemRef.current?.focus();
  }, [toolsOpen]);

  useEffect(() => {
    if (mobileOpen) firstMobileItemRef.current?.focus();
  }, [mobileOpen]);

  // Shrink header on scroll
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setPaletteOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <header
      className={`sticky top-0 z-30 w-full border-b border-sidebar-border bg-sidebar transition-[height] duration-150 ease-out ${
        scrolled ? "h-14" : "h-16"
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link
            href="/"
            className="shrink-0 font-display text-base text-sidebar-foreground tracking-tight whitespace-nowrap sm:text-lg"
          >
            RuneMarket
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              const isNew = NEW_ITEM_HREFS.includes(href) && !seenNew.includes(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="whitespace-nowrap">{label}</span>
                  {isNew && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  )}
                </Link>
              );
            })}

            {/* Tools dropdown */}
            <div className="relative" ref={toolsRef}>
              <button
                ref={toolsButtonRef}
                onClick={() => setToolsOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={toolsOpen}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  toolsActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <span className="whitespace-nowrap">
                  {activeTool ? activeTool.label : "Tools"}
                </span>
                {!toolsActive && NEW_ITEM_HREFS.some((h) => !seenNew.includes(h)) && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              </button>

              {toolsOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-md border border-sidebar-border bg-card py-1 shadow-lg"
                >
                  {[...TOOLS_ITEMS]
                    .sort((a, b) => {
                      if (a.href === recentTool) return -1;
                      if (b.href === recentTool) return 1;
                      return 0;
                    })
                    .map(({ href, label, icon: Icon }, i) => {
                      const active = isActive(pathname, href);
                      const isRecent = href === recentTool && !active;
                      const isNew = NEW_ITEM_HREFS.includes(href) && !seenNew.includes(href);
                      return (
                        <Link
                          key={href}
                          ref={i === 0 ? firstToolsItemRef : undefined}
                          href={href}
                          role="menuitem"
                          onClick={() => setToolsOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                          <span className="whitespace-nowrap">{label}</span>
                          {isNew && (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              New
                            </span>
                          )}
                          {label === "Alerts" && triggeredCount > 0 && (
                            <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-medium text-white">
                              {triggeredCount > 9 ? "9+" : triggeredCount}
                            </span>
                          )}
                          {isRecent && !isNew && (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                              recent
                            </span>
                          )}
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          </nav>

          {/* Command palette trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search pages and items"
            className="hidden items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 md:flex"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="whitespace-nowrap">Search...</span>
            <kbd className="ml-1 rounded border border-sidebar-border bg-sidebar px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          {/* Mobile menu trigger */}
          <button
            ref={mobileButtonRef}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 md:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search pages and items"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all duration-150 ease-out hover:text-primary hover:border-primary/40 hover:shadow-md active:scale-90 md:hidden"
          >
            <Search className="h-4.5 w-4.5" strokeWidth={2} />
          </button>

          {/* Alerts notification popover */}
          <div className="relative" ref={notifRef}>
            <button
              ref={notifButtonRef}
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notifOpen}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm
                transition-all duration-150 ease-out hover:text-primary hover:border-primary/40 hover:shadow-md
                active:scale-90"
            >
              <Bell className="h-4.5 w-4.5" strokeWidth={2} />
              {triggeredCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-medium text-white">
                  {triggeredCount > 9 ? "9+" : triggeredCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-md border border-border bg-card shadow-lg"
              >
                <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Triggered alerts
                </div>
                {triggeredAlerts.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No triggered alerts right now.
                  </p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {triggeredAlerts.slice(0, 6).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/item/${a.itemId}`}
                          onClick={() => setNotifOpen(false)}
                          className="flex flex-col gap-0.5 px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/60"
                        >
                          <span className="font-medium text-foreground">{a.itemName}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.priceType} went {a.direction} {a.targetPrice.toLocaleString()}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/profile#alerts"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:bg-sidebar-accent/60"
                >
                  Manage all alerts
                </Link>
              </div>
            )}
          </div>

          <TopRightControls />
        </div>
      </div>

      {/* Mobile sheet menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <span className="font-display text-base text-sidebar-foreground tracking-tight">
                RuneMarket
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto p-3">
              {PRIMARY_ITEMS.map(({ href, label, icon: Icon }, i) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    ref={i === 0 ? firstMobileItemRef : undefined}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                    {label}
                  </Link>
                );
              })}

              <div className="mt-2 mb-1 px-3 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/40">
                Tools
              </div>

              {TOOLS_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                const isNew = NEW_ITEM_HREFS.includes(href) && !seenNew.includes(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                    {label}
                    {isNew && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        New
                      </span>
                    )}
                    {label === "Alerts" && triggeredCount > 0 && (
                      <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-medium text-white">
                        {triggeredCount > 9 ? "9+" : triggeredCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Command palette: static pages + live item search */}
      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Search"
        description="Jump to a page or find an item"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search pages or items..."
          value={paletteQuery}
          onValueChange={setPaletteQuery}
        />
        <CommandList>
          {paletteQuery.trim().length < 2 && (
            <CommandGroup heading="Pages">
              {ALL_ITEMS.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={label} onSelect={() => runCommand(href)}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {paletteQuery.trim().length >= 2 && (
            <>
              <CommandGroup heading="Pages">
                {ALL_ITEMS.filter((item) =>
                  item.label.toLowerCase().includes(paletteQuery.trim().toLowerCase())
                ).map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={label} onSelect={() => runCommand(href)}>
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span>{label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Items">
                {itemSearchLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching items...
                  </div>
                )}
                {!itemSearchLoading && itemResults.length === 0 && (
                  <CommandEmpty>No items found.</CommandEmpty>
                )}
                {itemResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`item-${item.id}-${item.name}`}
                    onSelect={() => runCommand(`/item/${item.id}`)}
                  >
                    {item.iconUrl ? (
                      <Image src={item.iconUrl} alt="" width={20} height={20} className="shrink-0" />
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded bg-muted" />
                    )}
                    <span>{item.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </header>
  );
}