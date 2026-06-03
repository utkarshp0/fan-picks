"use client";

import {
  Activity,
  ClipboardList,
  LoaderCircle,
  LogOut,
  Plus,
  QrCode,
  Radio,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { LoginScreen } from "@/components/auth/login-screen";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { getPostLogoutHref } from "@/lib/auth-navigation.mjs";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { profile, logout } = useGuestSession();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState("");
  const visiblePendingHref = pendingHref === pathname ? "" : pendingHref;
  const activeChampionshipId = getChampionshipIdFromPath(pathname);
  const appNavItems = [
    { href: "/championships", icon: Trophy, label: "Pools" },
    { href: "/live-scores", icon: Radio, label: "Live Scores" },
    { href: "/championships/create", icon: Plus, label: "Create Pool" },
    { href: "/championships/join", icon: QrCode, label: "Join Pool" },
  ];
  const poolNavItems = activeChampionshipId
    ? [
        {
          href: `/championships/${activeChampionshipId}/predictions`,
          icon: Trophy,
          label: "Picks",
        },
        {
          href: `/championships/${activeChampionshipId}/participants`,
          icon: Users,
          label: "Participants",
        },
        {
          href: `/championships/${activeChampionshipId}/audit`,
          icon: Activity,
          label: "Audit Log",
        },
        {
          href: `/championships/${activeChampionshipId}/rules`,
          icon: ClipboardList,
          label: "Bets",
        },
      ]
    : [];
  const navItems = [...appNavItems, ...poolNavItems];

  useEffect(() => {
    function handleRouteStart(event: Event) {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;

      if (href && href !== pathname) {
        setPendingHref(href);
      }
    }

    window.addEventListener("fanpicks:route-start", handleRouteStart);

    return () => {
      window.removeEventListener("fanpicks:route-start", handleRouteStart);
    };
  }, [pathname]);

  function handleNavigate(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (
      href === pathname ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    setPendingHref(href);
    window.dispatchEvent(
      new CustomEvent("fanpicks:route-start", { detail: { href } }),
    );
  }

  function handleLogout() {
    logout();
    router.replace(getPostLogoutHref());
  }

  if (!profile) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNavigationLoader isVisible={Boolean(visiblePendingHref)} />
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background px-5 py-5 lg:flex lg:flex-col">
          <Link className="flex min-h-11 items-center gap-3" href="/championships">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <Trophy aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold">Fan Picks</p>
              <p className="text-xs text-muted">Back your opinions</p>
            </div>
          </Link>

          <div className="mt-5 rounded-lg border border-border bg-surface p-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-raised text-accent">
                <UserCircle aria-hidden className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.displayName}</p>
                <p className="truncate text-xs text-muted">@{profile.handle}</p>
              </div>
            </div>
            <button
              className="mt-3 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              onClick={handleLogout}
              type="button"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              Logout
            </button>
          </div>

          <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
            <NavLinks
              items={appNavItems}
              onNavigate={handleNavigate}
              pathname={pathname}
              pendingHref={visiblePendingHref}
            />

            {poolNavItems.length > 0 ? (
              <>
                <p className="mt-5 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Current Pool
                </p>
                <NavLinks
                  items={poolNavItems}
                  onNavigate={handleNavigate}
                  pathname={pathname}
                  pendingHref={visiblePendingHref}
                />
              </>
            ) : null}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/92 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
            <div className="flex min-h-12 items-center justify-between gap-3">
              <Link className="flex min-w-0 items-center gap-3" href="/championships">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Trophy aria-hidden className="h-5 w-5" />
                </div>
                <span className="truncate text-lg font-semibold text-foreground">
                  Fan Picks
                </span>
              </Link>
              <div className="flex min-w-0 items-center gap-2">
                <span className="hidden max-w-28 truncate text-sm font-medium text-foreground sm:inline">
                  {profile.displayName}
                </span>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-surface hover:text-foreground"
                  onClick={handleLogout}
                  type="button"
                >
                  <LogOut aria-hidden className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted",
                    isNavItemActive(pathname, item.href) &&
                      "border-accent bg-accent/10 text-accent",
                    visiblePendingHref === item.href && "border-accent text-accent",
                  )}
                  href={item.href}
                  key={item.label}
                  onClick={(event) => handleNavigate(event, item.href)}
                >
                  {visiblePendingHref === item.href ? (
                    <LoaderCircle
                      aria-hidden
                      className="h-4 w-4 animate-spin text-accent"
                    />
                  ) : (
                    <item.icon aria-hidden className="h-4 w-4" />
                  )}
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="flex-1 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

type NavLinkItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

function NavLinks({
  items,
  onNavigate,
  pathname,
  pendingHref,
}: {
  items: NavLinkItem[];
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  pathname: string;
  pendingHref: string;
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          className={cn(
            "relative flex min-h-11 items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground",
            isNavItemActive(pathname, item.href) && "bg-surface-raised text-foreground",
            pendingHref === item.href && "bg-accent/10 text-accent",
          )}
          href={item.href}
          key={item.label}
          onClick={(event) => onNavigate(event, item.href)}
        >
          {pendingHref === item.href ? (
            <>
              <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
              <LoaderCircle
                aria-hidden
                className="h-4 w-4 animate-spin text-accent"
              />
            </>
          ) : (
            <item.icon aria-hidden className="h-4 w-4" />
          )}
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function announceRouteStart(href: string) {
  window.dispatchEvent(
    new CustomEvent("fanpicks:route-start", { detail: { href } }),
  );
}

function AppNavigationLoader({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-background/72 text-foreground backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-accent/10">
        <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] rounded-r-full bg-accent shadow-[0_0_18px_rgba(24,195,126,0.65)]" />
      </div>
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="grid w-full max-w-xs place-items-center gap-4 rounded-lg border border-border bg-surface/96 p-6 text-center shadow-2xl shadow-black/40">
          <div className="relative grid h-16 w-16 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Trophy aria-hidden className="h-7 w-7" />
            <span className="absolute -inset-2 rounded-xl border border-accent/35 animate-[loader-ring_1.2s_ease-out_infinite]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Loading Fan Picks</p>
            <p className="mt-1 text-xs text-muted">Getting the next page ready</p>
          </div>
          <LoaderCircle aria-hidden className="h-5 w-5 animate-spin text-accent" />
        </div>
      </div>
    </div>
  );
}

function isNavItemActive(pathname: string, href: string) {
  return pathname === href;
}

function getChampionshipIdFromPath(pathname: string) {
  const match = pathname.match(/^\/championships\/([^/]+)/);

  if (match?.[1] === "create" || match?.[1] === "join") {
    return undefined;
  }

  return match?.[1];
}
