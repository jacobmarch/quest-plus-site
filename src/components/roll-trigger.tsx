"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  PRESET_SIDES,
  evaluateDiceExpression,
  presetExpression,
} from "@/lib/rolls";
import { toastRoll } from "@/lib/roll-toast";

export function RollTrigger({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [expression, setExpression] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(raw: string) {
    const evaluated = evaluateDiceExpression(raw);
    if (!evaluated.ok) {
      toast.error(evaluated.error);
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const rollerId = userData.user?.id ?? userId;
      const { error } = await supabase.from("rolls").insert({
        roller_id: rollerId,
        roller_display_name: displayName,
        is_private: isPrivate,
        expression: evaluated.value.expression,
        faces: evaluated.value.faces,
        constant: evaluated.value.constant,
        total: evaluated.value.total,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toastRoll({
        roller_display_name: displayName,
        is_private: isPrivate,
        ...evaluated.value,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 border-t p-3">
      <p className="px-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Roll
      </p>
      <div className="flex flex-wrap gap-1">
        {PRESET_SIDES.map((sides) => (
          <Button
            key={sides}
            type="button"
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => void submit(presetExpression(sides))}
          >
            d{sides}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(expression);
        }}
      >
        <Input
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="2d6+3"
          aria-label="Custom dice expression"
          disabled={pending}
          className="h-7 text-xs"
        />
        <Button type="submit" size="xs" disabled={pending}>
          Roll
        </Button>
      </form>
      <div className="flex gap-1">
        <Button
          type="button"
          size="xs"
          variant={isPrivate ? "outline" : "default"}
          onClick={() => setIsPrivate(false)}
        >
          Public
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isPrivate ? "default" : "outline"}
          onClick={() => setIsPrivate(true)}
        >
          Private
        </Button>
      </div>
    </div>
  );
}
