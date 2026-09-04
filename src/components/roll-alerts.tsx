"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RollRow } from "@/lib/database.types";
import { toastRoll } from "@/lib/roll-toast";

export function RollAlerts({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rolls-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rolls" },
        (payload) => {
          const roll = payload.new as RollRow;
          if (roll.roller_id === userId) return;
          toastRoll(roll);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
