# Sessions and Game Events

These are different features. **Sessions** are recap notes. **Game Events** are a DM-only audit of character, skill, and inventory mutations. Neither is a live table, chat, or the Roll log.

## Sessions (recap notes)

Table `session_notes`: `title`, `occurred_on` (date), `content_md`, timestamps.

- List: `/sessions` — all authenticated members can read (RLS). DM sees a create dialog.
- Detail: `/sessions/[id]` — lightweight markdown render (headings, lists, `**bold**`), not a full MD engine.
- Writes: `upsertSessionNote` / `deleteSessionNote` (DM). UI: [`session-note-dialog.tsx`](../src/components/session-note-dialog.tsx).
- Dashboard shows the three most recent notes.

`updated_at` is maintained by `private.touch_updated_at`.

## Game Events

Table `audit_events`: `actor_id`, `target_character_id`, `target_owner_id`, `entity_type`, `action`, `description`, `before_data`, `after_data`.

- Filled by trigger `private.record_audit_event` on `characters`, `inventory`, `character_skills`, and `session_notes` (see migrations). Authenticated clients cannot insert/update/delete this table.
- Select policy: DM only.
- Page `/events` (`requireDm`) loads up to 2000 rows newest first and renders [`AuditLog`](../src/components/audit-log.tsx).
- [`getAuditChanges`](../src/lib/audit.ts) diffs jsonb snapshots for the UI (ignores `id`, `created_at`, `updated_at`).

Rolls do not write audit events. Do not mix dice history into this trail.
