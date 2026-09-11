# Skills and class trees

Each **class** has a directed acyclic graph of **abilities** (`skills`). Abilities are binary: unlocked or not. There are no ranks. Spending writes `character_skills`; definitions live on `skills`.

## Classes

Table `classes`: `name`, `description`, `points_per_level`. DM CRUD via `upsertClass` / `deleteClass` and [`ClassManagerDialog`](../src/components/class-manager-dialog.tsx) on `/trees`.

Deleting a class sets characters’ `class_id` to null (`ON DELETE SET NULL`) and cascades skill definitions.

## Skill definitions

Table `skills`: `class_id`, `name`, `description`, `cost`, `prereq_skill_ids uuid[]`, `is_default`.

- **Prerequisites:** same-class, acyclic. Enforced by `private.validate_skill_prereqs` on write.
- **Starting skills:** `is_default`. Granted by `grant_default_skills` at character create. They do not consume the point budget. `unlock_skill` rejects unlocking them again.
- Layout positions are derived in the client (`deriveTiers` in [`src/lib/skills.ts`](../src/lib/skills.ts)), not stored as x/y (those columns were removed after the initial schema).

DM edits trees on `/trees/[classId]` with [`TreeEditor`](../src/components/tree-editor.tsx) and [`SkillTreeView`](../src/components/skill-tree-view.tsx): add nodes, toggle prereq links, set cost and starting flag.

## Point budget

[`computeSkillPoints`](../src/lib/skills.ts) and `unlock_skill`:

```
total = max(0, (level - 1) * points_per_level)
spent = sum of cost for learned non-default skills (capped at total in the UI helper)
available = total - spent
```

Level 1 grants no spendable points. Starting skills are free. `lock_skill` removes a learned row (cannot lock a starting skill that is only default, depending on RPC rules).

`character_skills` has no `INSERT`/`UPDATE`/`DELETE` for `authenticated`; only RPCs write it.

## Unlock / lock

| RPC | Rules (current `unlock_skill` / `lock_skill`) |
| --- | --- |
| `unlock_skill` | Editor of the character; class matches; not default; not already learned; prereqs learned; budget ≥ cost |
| `lock_skill` | Editor; refunds the ability (starting skills stay granted via `is_default` even if not in `character_skills`) |

UI node states (`getSkillNodeState`): `unlocked`, `available` (prereqs met), `locked`.

Older migrations defined `spend_skill_points` / `refund_skill_points` and ranks; later migrations replaced that model. Do not call the old RPCs; they are not in `database.types.ts`.

## Player vs DM

Players spend on their sheet’s Skills tab. The DM designs trees and can also unlock/lock on any sheet they can edit (including enemies with a class).
