"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EFFECT_DESCRIPTION_MAX,
  EFFECT_IMPACT_MAX,
  EFFECT_NAME_MAX,
  type ItemEffect,
} from "@/lib/items";

export function emptyDraftEffect(): ItemEffect {
  return {
    name: "",
    description: "",
    impact: "",
    hidden: false,
    revealed: true,
  };
}

export function EffectList({
  effects,
  isDm,
  idPrefix,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  onToggleHidden,
  onToggleRevealed,
}: {
  effects: ItemEffect[];
  isDm: boolean;
  idPrefix: string;
  draft: ItemEffect;
  onDraftChange: (draft: ItemEffect) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onToggleHidden?: (index: number, hidden: boolean) => void;
  onToggleRevealed?: (index: number, revealed: boolean) => void;
}) {
  return (
    <div className="space-y-3 sm:col-span-2">
      <p className="text-sm font-medium">Effects</p>
      {effects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No extra effects yet. Add life steal, fire, a goblin-glow — each as
          its own row.
        </p>
      ) : (
        <ul className="space-y-3">
          {effects.map((effect, index) => {
            if (!isDm && effect.hidden && !effect.revealed) return null;
            const playerLocked = effect.hidden && !isDm;
            return (
              <li
                key={`${effect.name}-${index}`}
                className="space-y-1 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {effect.name}
                      {isDm && effect.hidden ? (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {onToggleRevealed
                            ? effect.revealed
                              ? "revealed"
                              : "hidden"
                            : "hidden by default"}
                        </span>
                      ) : null}
                    </p>
                    {effect.description ? (
                      <p className="text-sm text-muted-foreground">
                        {effect.description}
                      </p>
                    ) : null}
                    {effect.impact ? (
                      <p className="text-sm">{effect.impact}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {isDm && onToggleRevealed && effect.hidden ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onToggleRevealed(index, !effect.revealed)
                        }
                      >
                        {effect.revealed ? "Hide from player" : "Reveal to player"}
                      </Button>
                    ) : null}
                    {playerLocked ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {isDm && onToggleHidden ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={effect.hidden}
                      onChange={(event) =>
                        onToggleHidden(index, event.target.checked)
                      }
                    />
                    Hidden by default
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-effect-name`}>Effect</Label>
          <Input
            id={`${idPrefix}-effect-name`}
            value={draft.name}
            placeholder="e.g. Lights on fire"
            maxLength={EFFECT_NAME_MAX}
            onChange={(event) =>
              onDraftChange({ ...draft, name: event.target.value })
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-effect-description`}>Description</Label>
          <Input
            id={`${idPrefix}-effect-description`}
            value={draft.description}
            placeholder="e.g. Flames lick the blade when drawn"
            maxLength={EFFECT_DESCRIPTION_MAX}
            onChange={(event) =>
              onDraftChange({ ...draft, description: event.target.value })
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-effect-impact`}>Impact</Label>
          <Input
            id={`${idPrefix}-effect-impact`}
            value={draft.impact}
            placeholder="e.g. +2 fire damage"
            maxLength={EFFECT_IMPACT_MAX}
            onChange={(event) =>
              onDraftChange({ ...draft, impact: event.target.value })
            }
          />
        </div>
        {isDm ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.hidden}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  hidden: event.target.checked,
                  revealed: !event.target.checked,
                })
              }
            />
            Hidden by default
          </label>
        ) : null}
        <Button type="button" variant="secondary" onClick={onAdd}>
          Add effect
        </Button>
      </div>
    </div>
  );
}
