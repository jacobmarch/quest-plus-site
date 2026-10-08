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

// ------------------------------------------------------------ catalog

export const ASSIGN_QUANTITY_MAX = 999;

export type ItemHolder = {
  characterId: string;
  characterName: string;
  quantity: number;
};

/** Inventory copies match catalog items by name, case-insensitively. */
export function catalogKey(name: string) {
  return name.trim().toLowerCase();
}

export function holdersByItemName(
  inventory: Array<{ character_id: string; item_name: string; quantity: number }>,
  characterNames: Map<string, string>,
): Map<string, ItemHolder[]> {
  const byName = new Map<string, ItemHolder[]>();
  for (const row of inventory) {
    const key = catalogKey(row.item_name);
    const list = byName.get(key) ?? [];
    list.push({
      characterId: row.character_id,
      characterName: characterNames.get(row.character_id) ?? "Unknown character",
      quantity: row.quantity,
    });
    byName.set(key, list);
  }
  for (const list of byName.values()) {
    list.sort((a, b) => a.characterName.localeCompare(b.characterName));
  }
  return byName;
}

export type CatalogFilter = {
  query: string;
  kind: "all" | "unique" | "common";
  /** "any", "unclaimed", or a character id. */
  holder: string;
};

export function filterCatalog<
  T extends { name: string; description: string; effects: Json; is_unique: boolean },
>(items: T[], holders: Map<string, ItemHolder[]>, filter: CatalogFilter): T[] {
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filter.kind === "unique" && !item.is_unique) return false;
    if (filter.kind === "common" && item.is_unique) return false;
    const itemHolders = holders.get(catalogKey(item.name)) ?? [];
    if (filter.holder === "unclaimed" && itemHolders.length > 0) return false;
    if (
      filter.holder !== "any" &&
      filter.holder !== "unclaimed" &&
      !itemHolders.some((h) => h.characterId === filter.holder)
    ) {
      return false;
    }
    if (terms.length === 0) return true;
    const haystack = [
      item.name,
      item.description,
      ...parseItemEffects(item.effects).map((e) => e.name),
      ...itemHolders.map((h) => h.characterName),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export type AssignPlan =
  | { kind: "grant"; quantity: number }
  | { kind: "transfer"; fromCharacterId: string; quantity: number };

/**
 * How to put a catalog item in a character's pack. A unique item lives with
 * one character at a time, so if someone already holds it, it moves (with any
 * effects already revealed on that copy) instead of a second copy appearing.
 */
export function planAssignment(input: {
  isUnique: boolean;
  holders: Array<{ characterId: string; characterName: string; quantity: number }>;
  targetCharacterId: string;
  quantity: number;
}): AssignPlan {
  if (!input.targetCharacterId) throw new Error("Choose a character");
  if (input.isUnique) {
    const target = input.holders.find(
      (h) => h.characterId === input.targetCharacterId,
    );
    if (target) throw new Error(`${target.characterName} already has it`);
    const current = input.holders[0];
    return current
      ? { kind: "transfer", fromCharacterId: current.characterId, quantity: 1 }
      : { kind: "grant", quantity: 1 };
  }
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > ASSIGN_QUANTITY_MAX
  ) {
    throw new Error(`Quantity must be between 1 and ${ASSIGN_QUANTITY_MAX}`);
  }
  return { kind: "grant", quantity: input.quantity };
}
