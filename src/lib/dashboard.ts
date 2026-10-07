import { parseDiceExpression } from "@/lib/rolls";

export const RECENT_ROLL_COUNT = 5;

export type HpStatus = "dead" | "down" | "critical" | "bloodied" | "healthy";

/**
 * Condition band for at-a-glance health. Critical is at or under a quarter
 * (matching the sheet's red bar); bloodied is at or under half.
 */
export function getHpStatus(character: {
  current_hp: number;
  max_hp: number;
  is_dead: boolean;
}): HpStatus {
  if (character.is_dead) return "dead";
  if (character.current_hp <= 0) return "down";
  const ratio = character.current_hp / Math.max(character.max_hp, 1);
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "bloodied";
  return "healthy";
}

export function hpPercent(character: { current_hp: number; max_hp: number }) {
  const pct = (character.current_hp / Math.max(character.max_hp, 1)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Apply damage (negative) or healing (positive), clamped to 0..max. */
export function applyHpDelta(
  character: { current_hp: number; max_hp: number },
  delta: number,
): number {
  return Math.min(
    character.max_hp,
    Math.max(0, character.current_hp + Math.trunc(delta)),
  );
}

export type NaturalResult = "nat20" | "nat1" | null;

/**
 * A natural 20 or 1 only makes sense when the Roll had exactly one die and it
 * was a d20 (e.g. `d20` or `1d20+5`). Multi-die rolls are not flagged because
 * stored faces do not record which die produced them.
 */
export function getNaturalResult(roll: {
  expression: string;
  faces: number[];
}): NaturalResult {
  const parsed = parseDiceExpression(roll.expression);
  if (!parsed.ok || parsed.value.dieCount !== 1) return null;
  const die = parsed.value.terms.find((term) => term.kind === "die");
  if (!die || die.kind !== "die" || die.sides !== 20) return null;
  if (roll.faces[0] === 20) return "nat20";
  if (roll.faces[0] === 1) return "nat1";
  return null;
}

/** Newest Roll per roller, given Rolls sorted newest first. */
export function latestRollByRoller<T extends { roller_id: string }>(
  rollsNewestFirst: T[],
): Map<string, T> {
  const byRoller = new Map<string, T>();
  for (const roll of rollsNewestFirst) {
    if (!byRoller.has(roll.roller_id)) byRoller.set(roll.roller_id, roll);
  }
  return byRoller;
}

export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
