# Auth and roles

There is one campaign and two roles on `profiles.role`: `dm` and `player`. The first account to sign up becomes the DM; every later account is a Player. Roles are not switchable from the app.

## Sign up and sign in

[`signUp`](../src/app/actions.ts), [`signIn`](../src/app/actions.ts), and [`signOut`](../src/app/actions.ts) wrap Supabase email/password Auth.

- Sign up stores `display_name` on `auth.users` metadata.
- If email confirmation is required, `signUp` gets no session and redirects to `/login?confirm=sent`.
- Sign out clears the session and redirects to `/login`.

Pages: [`src/app/login/page.tsx`](../src/app/login/page.tsx), [`src/app/signup/page.tsx`](../src/app/signup/page.tsx).

## First-user DM

Trigger `on_auth_user_created` on `auth.users` calls `private.handle_new_user`:

- If `profiles` is empty, the new row is `role = 'dm'`.
- Otherwise `role = 'player'`.
- `display_name` comes from metadata or the email local part.

A trigger `private.guard_profile_role_change` prevents changing `role` through ordinary updates.

## Proxy

[`src/proxy.ts`](../src/proxy.ts) creates a server client from request cookies, calls `getUser()`, and:

- Redirects to `/login` when there is no user and the path is not `/login` or `/signup`.
- Redirects to `/` when there is a user on those auth pages.

Static assets and images are excluded via `config.matcher`. This is the Next.js 16 equivalent of middleware, not an Edge Function you configure separately.

## Session helpers

[`src/lib/auth.ts`](../src/lib/auth.ts):

| Function | Behavior |
| --- | --- |
| `getSessionContext()` | Auth user + `profiles` row, or `null`. `isDm` is `profile.role === "dm"`. |
| `requireSession()` | Throws `"Not authenticated"` if missing. |
| `requireDm()` | Throws `"Only the DM can do that"` if not DM. |
| `requirePlayer()` | Redirects the DM to `/party`. |

The `(app)` layout redirects to `/login` if `getSessionContext()` is null (for example a user with no profile row).

## Who may do what (app + RLS)

Both roles connect as Postgres role `authenticated`. Authorization is RLS and RPCs, plus action-level checks.

| Capability | Player | DM |
| --- | --- | --- |
| Create own PC | Yes (`kind = 'pc'`, `owner_id` = self) | No (`createCharacter` rejects) |
| Create enemy | No | Yes (`kind = 'enemy'`) |
| View/edit own PC | Yes | Yes (all PCs) |
| View other PCs / enemies | No (RLS) | Yes |
| Level, XP, kind, owner | No (column grants + `dm_update_character`) | Yes via RPC |
| Classes, skill definitions, item catalog | Read (if RLS allows) / no write | CRUD |
| Session notes write | No | Yes |
| Game Events | No (`requireDm` + RLS select DM-only) | Yes |
| Rolls | Insert own; see Public + own Private | Insert own; see all |

`private.is_dm()`, `private.can_view_character`, and `private.can_edit_character` are `security definer` helpers in the unexposed `private` schema so policies do not recurse on `profiles`.

Players hitting a DM-only URL still fail: pages call `requireDm()` and/or RLS returns no rows (`notFound` on a sheet they cannot edit).
