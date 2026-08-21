# Quest Plus

Campaign manager for a custom D&D spin-off: character sheets, per-class skill
trees with point spending, inventory transfers, a bestiary for enemies, and
session notes.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + Row Level Security)
- React Flow (@xyflow/react) for interactive skill trees
- Deploys to Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

Environment variables:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) API key |

## First-run notes

- The **first account to sign up becomes the DM**; everyone after is a player.
- New signups require email confirmation (Supabase default). Confirming via
  the emailed link is required before signing in.
- As the DM: create classes under **Skill Trees**, add skill nodes (drag to
  arrange, drag between node handles to link prerequisites), define items
  under **Items**, then create enemies in the **Bestiary**.
- Players: create a character, pick its class, and spend skill points on the
  Skills tab. Points available = level x points-per-level minus spent cost.

## Security model

- Row Level Security on every table. Players see/edit only their own PCs;
  the DM sees everything.
- Level, XP, ownership, and enemy records change only through validated
  Postgres functions (`dm_update_character`).
- Skill ranks can only be written through `spend_skill_points` /
  `refund_skill_points`, which enforce prerequisites, max ranks, and point
  budgets server-side.
- Item moves between characters go through an atomic `transfer_inventory`
  RPC (DM-only).

## Database migrations

Versioned SQL lives in `supabase/migrations/` and is applied to the linked
Supabase project in order.

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint
```
