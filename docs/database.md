# Database

Postgres is the source of truth. Versioned SQL is in [`supabase/migrations/`](../supabase/migrations/). TypeScript shapes: [`src/lib/database.types.ts`](../src/lib/database.types.ts). Later migrations replace functions and columns; read the latest definition, not the first file that introduced a name.

## Tables (current)

| Table | Purpose |
| --- | --- |
| `profiles` | `id` = `auth.users`; `display_name`; `role` `dm` \| `player` |
| `classes` | Class name, description, `points_per_level` |
| `skills` | Per-class abilities: `cost`, `prereq_skill_ids`, `is_default` |
| `characters` | `kind` pc/enemy, owner, level, xp, HP, notes, `is_dead`, `stats` jsonb, coin columns |
| `character_skills` | Learned abilities (`character_id`, `skill_id`); no rank column |
| `items` | DM catalog: name, description, `damage`, `effects` jsonb |
| `inventory` | Per-character copies: `item_name`, `quantity`, `damage`, `effects`, optional `item_id` |
| `session_notes` | Recap markdown |
| `audit_events` | DM-only Game Events log |
| `rolls` | Dice history; Realtime publication |

Unexposed schema `private`: `is_dm()`, `can_view_character`, `can_edit_character`, triggers (`handle_new_user`, `touch_updated_at`, `guard_profile_role_change`, `validate_skill_prereqs`, `record_audit_event`, effect-filter helpers).

## Public RPCs (current)

| Function | Role |
| --- | --- |
| `dm_update_character(p_id, p_updates)` | DM; allowlisted fields including level, xp, kind, owner |
| `unlock_skill` / `lock_skill` | Editors; binary spend/refund and prereqs |
| `grant_default_skills(p_character)` | Copy `is_default` skills onto a new character |
| `adjust_inventory` | Quantity delta by item name |
| `transfer_inventory` | DM atomic move |
| `update_inventory_details` | Damage/effects on a copy |
| `list_inventory` / `list_visible_inventory` | Viewer-filtered effects |

## RLS pattern

- Enable RLS on public tables.
- Policies use `private.is_dm()` and character ownership, not a second Postgres role.
- `authenticated` is both Player and DM; column `GRANT`s and RPCs stop Players from writing level/xp/kind/owner or `character_skills` directly.
- `audit_events`: select DM only; no write grants to `authenticated`.
- `items`: select DM only.
- `rolls`: select visible; insert own `roller_id`.

## Migrations (one line each)

| File | Purpose |
| --- | --- |
| `20260821120000_create_initial_schema.sql` | Tables, first-user DM, RLS, initial `transfer_inventory` |
| `20260821130000_harden_columns_and_rpc.sql` | Column grants; old spend/refund; `dm_update_character` |
| `20260821140000_tiered_skill_trees.sql` | Prerequisite DAG validator |
| `20260821140100_pin_search_path_validator.sql` | `search_path` on validator |
| `20260821141000_binary_abilities.sql` | Drop ranks; `unlock_skill` / `lock_skill` |
| `20260821141100_fix_dm_update_character_casts.sql` | jsonb → uuid/int casts |
| `20260825211131_inventory_audit_log.sql` | `audit_events`; `adjust_inventory` |
| `20260825211857_free_form_inventory_items.sql` | Named inventory copies |
| `20260825223000_class_starter_skills.sql` | `is_default`; `grant_default_skills` |
| `20260829210000_character_coin_purse.sql` | Gold/silver/bronze |
| `20260830010000_item_damage_effect_features.sql` | Damage string; `update_inventory_details` |
| `20260830020000_hidden_item_knowledge.sql` | Hidden catalog knowledge; DM-only item select |
| `20260830030000_item_effect_list.sql` | `effects` jsonb list |
| `20260830163000_skill_points_after_level_one.sql` | Budget `(level - 1) * points_per_level` |
| `20260903003000_list_inventory_rpc.sql` | Viewer-filtered inventory reads |
| `20260903200000_rolls.sql` | `rolls` + Realtime |
