"use client";

import { toast } from "sonner";
import { formatRollBreakdown } from "@/lib/rolls";
import type { RollRow } from "@/lib/database.types";

export function toastRoll(roll: Pick<
  RollRow,
  | "roller_display_name"
  | "is_private"
  | "expression"
  | "faces"
  | "constant"
  | "total"
>) {
  const vis = roll.is_private ? "Private" : "Public";
  toast(
    `${roll.roller_display_name} · ${vis} · ${roll.expression} → ${roll.total}`,
    { description: formatRollBreakdown(roll) },
  );
}
