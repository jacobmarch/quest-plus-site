export const ALLOWED_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const PRESET_SIDES = ALLOWED_SIDES;
export const MAX_DICE_PER_ROLL = 100;

export type DieTerm = { kind: "die"; count: number; sides: number };
export type ConstTerm = { kind: "const"; value: number };
export type DiceTerm = DieTerm | ConstTerm;

export type ParsedExpression = {
  expression: string;
  terms: DiceTerm[];
  dieCount: number;
};

export type RolledDice = {
  expression: string;
  faces: number[];
  constant: number;
  total: number;
};

export type RollVisibility = {
  is_private: boolean;
  roller_id: string;
};

export type RollViewer = {
  id: string;
  isDm: boolean;
};

const SIDES = new Set<number>(ALLOWED_SIDES);

export function canViewerSeeRoll(
  roll: RollVisibility,
  viewer: RollViewer,
): boolean {
  if (!roll.is_private) return true;
  if (viewer.isDm) return true;
  return roll.roller_id === viewer.id;
}

export function parseDiceExpression(
  raw: string,
): { ok: true; value: ParsedExpression } | { ok: false; error: string } {
  const expression = raw.replace(/\s+/g, "").toLowerCase();
  if (!expression) {
    return { ok: false, error: "Enter a dice expression such as 2d6+3." };
  }

  const terms: DiceTerm[] = [];
  let i = 0;
  let dieCount = 0;

  while (i < expression.length) {
    let sign = 1;
    if (expression[i] === "+" || expression[i] === "-") {
      if (i === 0 && expression[i] === "+") {
        i += 1;
      } else if (i === 0 && expression[i] === "-") {
        sign = -1;
        i += 1;
      } else {
        sign = expression[i] === "-" ? -1 : 1;
        i += 1;
      }
    } else if (i !== 0) {
      return { ok: false, error: "Use + or - between terms." };
    }

    const rest = expression.slice(i);
    const dieMatch = rest.match(/^(\d*)d(\d+)/);
    const intMatch = rest.match(/^\d+/);

    if (dieMatch) {
      if (sign === -1) {
        return { ok: false, error: "Dice terms cannot be negative. Subtract a constant instead." };
      }
      const sides = Number(dieMatch[2]);
      if (!SIDES.has(sides)) {
        return {
          ok: false,
          error: "Dice must be d4, d6, d8, d10, d12, d20, or d100.",
        };
      }
      const count = dieMatch[1] === "" ? 1 : Number(dieMatch[1]);
      if (!Number.isInteger(count) || count < 1) {
        return { ok: false, error: "Each die term needs a count of at least 1." };
      }
      dieCount += count;
      if (dieCount > MAX_DICE_PER_ROLL) {
        return { ok: false, error: `At most ${MAX_DICE_PER_ROLL} dice per Roll.` };
      }
      terms.push({ kind: "die", count, sides });
      i += dieMatch[0].length;
    } else if (intMatch) {
      const value = sign * Number(intMatch[0]);
      terms.push({ kind: "const", value });
      i += intMatch[0].length;
    } else {
      return { ok: false, error: "Use sums of NdS and constants, e.g. 2d6+3." };
    }
  }

  if (dieCount < 1) {
    return { ok: false, error: "Include at least one die (for example d20 or 2d6)." };
  }

  return { ok: true, value: { expression, terms, dieCount } };
}

export function rollParsed(
  parsed: ParsedExpression,
  random: () => number = Math.random,
): RolledDice {
  const faces: number[] = [];
  let constant = 0;
  for (const term of parsed.terms) {
    if (term.kind === "const") {
      constant += term.value;
    } else {
      for (let n = 0; n < term.count; n += 1) {
        faces.push(1 + Math.floor(random() * term.sides));
      }
    }
  }
  const total = faces.reduce((sum, face) => sum + face, 0) + constant;
  return { expression: parsed.expression, faces, constant, total };
}

export function evaluateDiceExpression(
  raw: string,
  random?: () => number,
): { ok: true; value: RolledDice } | { ok: false; error: string } {
  const parsed = parseDiceExpression(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: rollParsed(parsed.value, random) };
}

export function presetExpression(sides: number): string {
  return `1d${sides}`;
}

export function formatRollBreakdown(roll: {
  faces: number[];
  constant: number;
  total: number;
}): string {
  const faces = `[${roll.faces.join(", ")}]`;
  if (roll.constant === 0) return `${faces} = ${roll.total}`;
  const sign = roll.constant > 0 ? "+" : "−";
  const mag = Math.abs(roll.constant);
  return `${faces} ${sign} ${mag} = ${roll.total}`;
}
