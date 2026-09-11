# Routes

Navigation is role-based in [`src/components/sidebar.tsx`](../src/components/sidebar.tsx). Pages that are omitted from Player nav still exist as files; the layout does not hide them by route group. DM-only pages call `requireDm()`. Character sheets additionally 404 if the viewer cannot edit that character.

## Unauthenticated

| Path | File | Notes |
| --- | --- | --- |
| `/login` | `src/app/login/page.tsx` | Email/password; `?confirm=sent` after signup without a session |
| `/signup` | `src/app/signup/page.tsx` | Email, password, display name |

Signed-in users are redirected away from these by `proxy.ts`.

## Shared (Player and DM)

| Path | File | Notes |
| --- | --- | --- |
| `/` | `(app)/page.tsx` | Dashboard: Player sees own PCs; DM sees party + enemy counts and recents |
| `/rolls` | `(app)/rolls/page.tsx` | Roll log (RLS-filtered), newest first |
| `/sessions` | `(app)/sessions/page.tsx` | Recap list; DM gets create dialog |
| `/sessions/[id]` | `(app)/sessions/[id]/page.tsx` | Recap body; DM can edit/delete |
| `/characters/[id]` | `(app)/characters/[id]/page.tsx` | Sheet if viewer can edit; `?tab=overview\|skills\|inventory` |

## Player nav only

| Path | File | Notes |
| --- | --- | --- |
| `/characters` | `(app)/characters/page.tsx` | “My Characters”; create PC |

## DM nav only

| Path | File | Notes |
| --- | --- | --- |
| `/party` | `(app)/party/page.tsx` | All PCs, owners, visible inventory |
| `/bestiary` | `(app)/bestiary/page.tsx` | Enemies; create enemy |
| `/trees` | `(app)/trees/page.tsx` | Classes |
| `/trees/[classId]` | `(app)/trees/[classId]/page.tsx` | Tree editor |
| `/items` | `(app)/items/page.tsx` | Item catalog |
| `/events` | `(app)/events/page.tsx` | Game Events (`audit_events`, last 2000) |

`requirePlayer()` is used where a Player-only list should bounce the DM (for example My Characters redirects the DM to `/party`).

## Sidebar

**Player:** Dashboard, My Characters, Rolls, Sessions.

**DM:** Dashboard, Party, Bestiary, Skill Trees, Items, Game Events, Rolls, Sessions.

Footer on both: **Roll trigger**, display name, role, sign out.
