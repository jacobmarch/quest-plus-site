import type { Json } from "@/lib/database.types";

export type AuditChange = {
  field: string;
  before: Json | undefined;
  after: Json | undefined;
};

const IGNORED_FIELDS = new Set(["id", "created_at", "updated_at"]);

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function getAuditChanges(
  before: Json | null,
  after: Json | null,
): AuditChange[] {
  const beforeObject = asObject(before);
  const afterObject = asObject(after);
  const fields = new Set([
    ...Object.keys(beforeObject),
    ...Object.keys(afterObject),
  ]);

  return [...fields]
    .filter((field) => !IGNORED_FIELDS.has(field))
    .filter(
      (field) =>
        JSON.stringify(beforeObject[field]) !== JSON.stringify(afterObject[field]),
    )
    .sort()
    .map((field) => ({
      field,
      before: beforeObject[field],
      after: afterObject[field],
    }));
}

export function formatAuditValue(value: Json | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
