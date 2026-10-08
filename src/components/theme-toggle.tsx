"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getServerTheme,
  getTheme,
  subscribeTheme,
  toggleTheme,
} from "@/lib/theme";

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
}

export function ThemeToggle({ className }: { className?: string }) {
  // Subscribing keeps OS-preference and cross-tab updates live while mounted.
  useTheme();

  // Both icons render and CSS picks one, so the server HTML is already right.
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={toggleTheme}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
