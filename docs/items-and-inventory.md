# Items and inventory

Two layers:

1. **Catalog** (`items`) — DM-defined templates (name, description, damage string, effects). Players cannot `SELECT` the catalog (DM-only policy).
2. **Inventory** (`inventory`) — per-character copies: `item_name`, `quantity`, `damage`, `effects` jsonb, optional `item_id`. Names are free-form; catalog grant copies fields onto a row.

## Catalog

`/items` + [`ItemsManager`](../src/components/items-manager.tsx). `upsertItem` sanitizes damage and effects ([`src/lib/items.ts`](../src/lib/items.ts)):

- Damage ≤ 80 characters
- At most 20 effects; name/description/impact length caps
- Each effect: `name`, `description`, `impact`, `hidden` (catalog); inventory copies add `revealed`

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
