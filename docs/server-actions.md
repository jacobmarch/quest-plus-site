# Server Actions

All Server Actions live in [`src/app/actions.ts`](../src/app/actions.ts) (`"use server"`). Shared result type:

```ts
type ActionResult = { ok: true } | { ok: false; error: string };
```

Successful mutations call `revalidatePath` for the pages that show the changed data. **Rolls are not actions**; see [rolls.md](rolls.md).

## Auth

| Action | Auth | Persistence |
| --- | --- | --- |
| `signUp(email, password, displayName)` | Public | `auth.signUp`; redirect `/` or `/login?confirm=sent` |
| `signIn(email, password)` | Public | `auth.signInWithPassword`; redirect `/` |
| `signOut()` | Session | `auth.signOut`; redirect `/login` |

## Characters

| Action | Auth | Persistence |
| --- | --- | --- |
| `createCharacter({ name, kind, classId?, maxHp? })` | Session; PC = not DM; enemy = DM | Insert `characters`; optional `grant_default_skills` |
| `updateCharacterFields(id, fields)` | Session | DM keys `level`, `xp`, `kind`, `owner_id` → `dm_update_character`; other keys → table `update` (column grants apply) |
| `deleteCharacter(id)` | Session | Delete `characters` (RLS) |
| `levelUpCharacter(id)` | DM | `dm_update_character` with `level + 1` |

## Skills on a sheet

| Action | Auth | Persistence |
| --- | --- | --- |
| `unlockSkill(characterId, skillId)` | Session | RPC `unlock_skill` |
| `lockSkill(characterId, skillId)` | Session | RPC `lock_skill` |

## Classes and skill definitions (DM)

| Action | Auth | Persistence |
| --- | --- | --- |
| `upsertClass({ id?, name, description, pointsPerLevel })` | DM | Insert or update `classes` |
| `deleteClass(id)` | DM | Delete `classes` |
| `upsertSkill({ id?, classId, name, description, cost, prereqSkillIds, isDefault })` | DM | Insert or update `skills` |
| `deleteSkill(id, classId)` | DM | Delete `skills` |

## Items and inventory

| Action | Auth | Persistence |
| --- | --- | --- |
| `upsertItem({ id?, name, description, damage, effects })` | DM | Sanitize then insert/update `items` |
| `deleteItem(id)` | DM | Delete `items` |
| `adjustInventory({ characterId, itemName, delta })` | Session | RPC `adjust_inventory` (non-zero integer delta, name ≤ 200) |
| `transferInventory({ fromCharacterId, toCharacterId, itemName, quantity })` | DM | RPC `transfer_inventory` |
| `updateInventoryDetails({ characterId, itemName, damage, effects })` | Session | Sanitize then RPC `update_inventory_details` |

## Session notes (DM)

| Action | Auth | Persistence |
| --- | --- | --- |
| `upsertSessionNote({ id?, title, occurredOn, contentMd })` | DM | Insert or update `session_notes` |
| `deleteSessionNote(id)` | DM | Delete `session_notes` |
