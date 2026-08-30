import type { Json } from "@/lib/database.types";

export type ItemEffect = {
  name: string;
  description: string;
  impact: string;
  hidden: boolean;
  revealed: boolean;
};

export const ITEM_DAMAGE_MAX = 80;
export const EFFECT_NAME_MAX = 80;
export const EFFECT_DESCRIPTION_MAX = 200;
export const EFFECT_IMPACT_MAX = 80;
export const EFFECTS_MAX = 20;

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function textField(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseItemEffects(value: Json): ItemEffect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((effect) => {
    if (
      typeof effect !== "object" ||
      effect === null ||
      Array.isArray(effect) ||
      typeof effect.name !== "string"
    ) {
      return [];
    }
    const hidden = asBoolean(effect.hidden, false);
    return [
      {
        name: effect.name,
        description: textField(effect.description),
        impact: textField(effect.impact) || textField(effect.detail),
        hidden,
        revealed: asBoolean(effect.revealed, !hidden),
      },
    ];
  });
}

export function effectIsVisible(
  effect: Pick<ItemEffect, "hidden" | "revealed">,
  isDm: boolean,
) {
  return isDm || !effect.hidden || effect.revealed;
}

export function formatItemSummary(input: {
  damage: string;
  effects: Json | ItemEffect[];
  isDm: boolean;
}): string {
  const parts: string[] = [input.damage.trim()];
  for (const effect of parseItemEffects(input.effects as Json)) {
    if (!effectIsVisible(effect, input.isDm)) continue;
    const body = effect.impact.trim()
      ? `${effect.name}: ${effect.impact}`
      : effect.name;
    parts.push(
      input.isDm && effect.hidden && !effect.revealed
        ? `${body} (hidden)`
        : body,
    );
  }
  return parts.filter(Boolean).join(" · ");
}

export function sanitizeDamage(damage: string) {
  const nextDamage = damage.trim();
  if (nextDamage.length > ITEM_DAMAGE_MAX) {
    throw new Error(`Damage must be ${ITEM_DAMAGE_MAX} characters or fewer`);
  }
  return nextDamage;
}

export function sanitizeEffects(
  effects: Array<{
    name: string;
    description?: string;
    impact?: string;
    hidden?: boolean;
    revealed?: boolean;
  }>,
): ItemEffect[] {
  if (effects.length > EFFECTS_MAX) {
    throw new Error(`At most ${EFFECTS_MAX} effects are allowed`);
  }
  return effects.map((effect) => {
    const name = effect.name.trim();
    const description = (effect.description ?? "").trim();
    const impact = (effect.impact ?? "").trim();
    if (!name) throw new Error("Effect name is required");
    if (name.length > EFFECT_NAME_MAX) {
      throw new Error(`Effect name must be ${EFFECT_NAME_MAX} characters or fewer`);
    }
    if (description.length > EFFECT_DESCRIPTION_MAX) {
      throw new Error(
        `Effect description must be ${EFFECT_DESCRIPTION_MAX} characters or fewer`,
      );
    }
    if (impact.length > EFFECT_IMPACT_MAX) {
      throw new Error(`Effect impact must be ${EFFECT_IMPACT_MAX} characters or fewer`);
    }
    const hidden = Boolean(effect.hidden);
    return {
      name,
      description,
      impact,
      hidden,
      revealed: effect.revealed ?? !hidden,
    };
  });
}
