"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { RollRow } from "@/lib/database.types";
import { toastRoll } from "@/lib/roll-toast";

export function RollAlerts({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const warningId = `rolls-connection-${userId}`;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    // Coalesce bursts of dice without reloading the document or losing filters.
    function refreshRolls() {
      if (disposed || refreshTimer !== undefined) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        router.refresh();
      }, 100);
    }

    function connectionFailed(error?: unknown) {
      if (disposed) return;
      console.warn("Rolls Realtime connection failed", error);
      toast.warning("Live roll updates are disconnected", {
        id: warningId,
        description: "Rolls can still be saved. Live updates will resume when the connection recovers.",
      });
    }

    async function subscribe() {
      // Resolve the current session through the SDK's token provider before joining.
      // Do not pin a JWT here: the SDK must keep using refreshed auth tokens.
      await supabase.realtime.setAuth();
      if (disposed) return;
      channel = supabase
        .channel(`rolls-inserts-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "rolls" },
          (payload) => {
            if (disposed) return;
            const roll = payload.new as RollRow;
            // Refresh for our own events too (including rolls from another tab).
            refreshRolls();
            // RLS already limits delivery to viewers allowed to see this roll.
            // A shared toast ID prevents a second toast in the originating tab.
            toastRoll(roll);
          },
        )
        .subscribe((status, error) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            toast.dismiss(warningId);
            // Close the initial fetch/subscribe gap and catch up after reconnects.
            refreshRolls();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            connectionFailed(error);
          }
        });
    }

    function onVisible() {
      if (document.visibilityState === "visible") refreshRolls();
    }

    void subscribe().catch(connectionFailed);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
      toast.dismiss(warningId);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}
