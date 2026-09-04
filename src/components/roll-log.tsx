"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RollRow } from "@/lib/database.types";
import { formatRollBreakdown } from "@/lib/rolls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VisibleRoll = Pick<
  RollRow,
  | "id"
  | "roller_id"
  | "roller_display_name"
  | "is_private"
  | "expression"
  | "faces"
  | "constant"
  | "total"
  | "created_at"
>;

export function RollLog({ rolls }: { rolls: VisibleRoll[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roller = searchParams.get("roller") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const rollers = useMemo(() => {
    const byId = new Map<string, string>();
    for (const roll of rolls) {
      if (!byId.has(roll.roller_id)) {
        byId.set(roll.roller_id, roll.roller_display_name);
      }
    }
    return [...byId.entries()]
      .map(([id, displayName]) => ({ id, displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rolls]);

  const filtered = useMemo(() => {
    const fromMs = from ? startOfLocalDay(from) : null;
    const toMs = to ? endOfLocalDay(to) : null;
    return rolls.filter((roll) => {
      if (roller !== "all" && roll.roller_id !== roller) return false;
      const at = new Date(roll.created_at).getTime();
      if (fromMs !== null && at < fromMs) return false;
      if (toMs !== null && at > toMs) return false;
      return true;
    });
  }, [rolls, roller, from, to]);

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") next.delete(name);
    else next.set(name, value);
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  if (rolls.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No Rolls yet. Use the sidebar to roll.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 border-y py-3">
        <label className="text-xs font-medium">
          Who rolled
          <Select value={roller} onValueChange={(value) => setFilter("roller", value)}>
            <SelectTrigger className="mt-1 min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {rollers.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-medium">
          From
          <Input
            type="date"
            value={from}
            onChange={(event) => setFilter("from", event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-xs font-medium">
          To
          <Input
            type="date"
            value={to}
            onChange={(event) => setFilter("to", event.target.value)}
            className="mt-1"
          />
        </label>
        {searchParams.size > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
            Clear
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rolls.length} Rolls
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No Rolls match these filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((roll) => (
            <li key={roll.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{roll.roller_display_name}</span>
                  <Badge variant="secondary">
                    {roll.is_private ? "Private" : "Public"}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(roll.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm">
                {roll.expression} → {roll.total}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRollBreakdown(roll)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function startOfLocalDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function endOfLocalDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}
