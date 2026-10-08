# Items and inventory

Two layers:

1. **Catalog** (`items`) — DM-defined templates (name, description, damage string, effects, `is_unique`). Players cannot `SELECT` the catalog (DM-only policy).
2. **Inventory** (`inventory`) — per-character copies: `item_name`, `quantity`, `damage`, `effects` jsonb, optional `item_id`. Names are free-form; catalog grant copies fields onto a row.

## Catalog

`/items` + [`ItemsManager`](../src/components/items-manager.tsx). `upsertItem` sanitizes damage and effects ([`src/lib/items.ts`](../src/lib/items.ts)):

- Damage ≤ 80 characters
- At most 20 effects; name/description/impact length caps
- Each effect: `name`, `description`, `impact`, `hidden` (catalog); inventory copies add `revealed`

The page is a searchable card grid. Each card shows who holds the item, found by matching inventory `item_name` to the catalog name case-insensitively (`holdersByItemName`); renaming a catalog item does not rename copies already handed out. Clicking a card opens a detail dialog to edit the item, give it to a character, or take it back.

**Unique items** (`is_unique`, e.g. "Gorvak's Axe") live with one character at a time. `assignItem` uses `planAssignment`: a unique item already held moves with `transfer_inventory` (keeping what was revealed on that copy); otherwise it is granted with `adjust_inventory`. New items default to unique. This is enforced in the app, not the database.

## Inventory rows

Grant/adjust quantity through `adjust_inventory` (`p_item_name`, integer `p_delta` ≠ 0). Transfer (DM only) through `transfer_inventory`. Edit damage/effects on a copy through `update_inventory_details`.

Reads must not leak hidden knowledge. Pages use:

- `list_inventory(p_character)` — one sheet
- `list_visible_inventory()` — party overview (all characters the viewer may see)

Those RPCs run `private.effects_for_viewer` so a Player gets hidden effects only after `revealed` is true. The DM sees hidden effects (UI may mark them).

Do not `select * from inventory` in the app for Player-facing UI; use the list RPCs.

## Hidden vs revealed

An effect with `hidden: true` is a catalog secret. On a character copy, `revealed` starts false for hidden effects. The DM reveals on the sheet via `updateInventoryDetails`. [`effectIsVisible`](../src/lib/items.ts): DM always; Player if not hidden or already revealed.

## Coin purse

Not inventory rows. `characters.gold_pieces`, `silver_pieces`, `bronze_pieces` (≥ 0), edited on the sheet through `updateCharacterFields` (column grants). [`CoinPurse`](../src/components/coin-purse.tsx).

## UI

[`InventoryPanel`](../src/components/inventory-panel.tsx) on the sheet: quantities, transfers, effect editing. Party page summarizes with `formatItemSummary`.
