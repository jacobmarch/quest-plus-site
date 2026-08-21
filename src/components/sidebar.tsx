"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Coins,
  LayoutDashboard,
  Network,
  ScrollText,
  Swords,
  Users,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dmOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/characters", label: "My Characters", icon: Users },
  { href: "/party", label: "Party", icon: Users, dmOnly: true },
  { href: "/bestiary", label: "Bestiary", icon: Swords, dmOnly: true },
  { href: "/trees", label: "Skill Trees", icon: Network, dmOnly: true },
  { href: "/items", label: "Items", icon: Coins, dmOnly: true },
  { href: "/sessions", label: "Sessions", icon: ScrollText },
];

export function Sidebar({
  displayName,
  role,
}: {
  displayName: string;
  role: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.dmOnly || role === "dm");

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <BookOpen className="size-5" />
        <span className="text-lg font-bold tracking-tight">Quest Plus</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <p className="truncate px-3 text-sm font-medium">{displayName}</p>
        <p className="px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {role}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
