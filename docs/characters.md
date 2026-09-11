# Characters

A **character** is a row in `characters`. `kind` is `pc` or `enemy`. PCs require `owner_id`; enemies typically have no owner. This is not a live combat tracker across clients: HP and notes persist on the sheet.

## Who creates what

- **Players** create their own PCs (`createCharacter` with `kind: "pc"`). The DM cannot create PCs through that action.
- **DM** creates enemies from the Bestiary (`kind: "enemy"`).
- After insert, if `class_id` is set, `grant_default_skills` copies `skills.is_default` into `character_skills`.

## Surfaces

| Surface | Audience | Code |
| --- | --- | --- |
| My Characters | Player | `(app)/characters/page.tsx` |
| Party | DM | `(app)/party/page.tsx` — PCs, owners, `list_visible_inventory` |
| Bestiary | DM | `(app)/bestiary/page.tsx` — enemies |
| Sheet | Editor | `(app)/characters/[id]/page.tsx` + `CharacterSheet` |
| Dashboard | Both | Own PCs (Player) or PC/enemy summaries (DM) |

The sheet 404s unless the viewer is the DM or the PC’s owner.

## Sheet tabs

`CharacterSheet` tabs (`?tab=`): **overview**, **skills**, **inventory**.

**Overview (typical fields):**

- Name, current/max HP (quick ±1/5/10)
- Level: DM edits via `updateCharacterFields` → `dm_update_character`; Player sees a number
- Coin purse: `gold_pieces`, `silver_pieces`, `bronze_pieces` (table update; column grants)
- Owner: DM only (`owner_id` via RPC)
- Notes, dead flag
- Delete character

`stats` jsonb exists on the row and is in `dm_update_character`’s allowed keys; the current sheet UI does not edit a stats block. XP is likewise a column/RPC field without a dedicated control beyond going through `updateCharacterFields` if passed.

**Skills:** [`SkillTreePanel`](../src/components/skill-tree-panel.tsx) — see [skills.md](skills.md).

**Inventory:** [`InventoryPanel`](../src/components/inventory-panel.tsx) — see [items-and-inventory.md](items-and-inventory.md). Transfer targets: DM sees all other characters; Player sees their other PCs.

## DM-owned vs player-editable fields

`updateCharacterFields` splits keys:

- **RPC (`dm_update_character`):** `level`, `xp`, `kind`, `owner_id` (action also sends the whole `fields` object into the RPC when any of those keys is present).
- **Table update:** everything else (`name`, HP, notes, coins, `class_id`, `is_dead`, …) subject to `GRANT UPDATE` on those columns.

Postgres still rejects Players writing DM-only columns even if the action were wrong. `levelUpCharacter` is DM-only and increments `level` through the RPC.

## RLS

`private.can_view_character` / `can_edit_character`: DM, or PC owned by `auth.uid()`. Enemies are DM-only. Deletes follow the same edit rule.
