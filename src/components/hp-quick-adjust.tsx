"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCharacterFields } from "@/app/actions";
import { applyHpDelta } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Compact damage/heal control for the dashboard so HP can change mid-fight
 * without opening the sheet.
 */
export function HpQuickAdjust({
  character,
}: {
  character: { id: string; name: string; current_hp: number; max_hp: number };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const value = Math.trunc(Number(amount));
  const valid = amount !== "" && Number.isFinite(value) && value > 0;

  function apply(sign: 1 | -1) {
    if (!valid) return;
    const next = applyHpDelta(character, sign * value);
    startTransition(async () => {
      const result = await updateCharacterFields(character.id, {
        current_hp: next,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAmount("");
      router.refresh();
    });
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        apply(-1);
      }}
    >
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="Amt"
        aria-label={`HP amount for ${character.name}`}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="h-7 w-16 px-2 text-sm"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-destructive"
        disabled={!valid || pending}
      >
        Damage
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2"
        disabled={!valid || pending}
        onClick={() => apply(1)}
      >
        Heal
      </Button>
    </form>
  );
}
