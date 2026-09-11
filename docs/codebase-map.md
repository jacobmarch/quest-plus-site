# Codebase map

Root layout of what lives where. Agent skills under `.agents/` are not documented here.

## Top level

| Path | Role |
| --- | --- |
| `src/` | Next.js app, components, libraries |
| `supabase/migrations/` | Ordered Postgres migrations |
| `docs/` | Architecture docs and feature specs (for example Rolls) |
| `CONTEXT.md` | Domain glossary |
| `README.md` | Setup and scripts |
| `package.json` | Dependencies and `dev` / `build` / `lint` / `test` |
| `vitest.config.ts` | Node environment, `src/**/*.test.ts`, `@/` alias |
| `components.json` | shadcn/ui config |
| `next.config.ts` | Next config (currently empty) |
| `eslint.config.mjs` | ESLint |
| `postcss.config.mjs` | Tailwind PostCSS |
| `tsconfig.json` | TypeScript; `@/*` → `src/*` |

## `src/app`

| File | Role |
| --- | --- |
| `layout.tsx` | Root HTML, fonts, toaster |
| `globals.css` | Tailwind / theme |
| `actions.ts` | All Server Actions except Rolls |
| `login/page.tsx` | Sign in |
| `signup/page.tsx` | Sign up |
| `(app)/layout.tsx` | Authenticated chrome |
| `(app)/page.tsx` | Dashboard (DM vs Player) |
| `(app)/characters/page.tsx` | Player: My Characters |
| `(app)/characters/[id]/page.tsx` | Character sheet |
| `(app)/party/page.tsx` | DM: party overview |
| `(app)/bestiary/page.tsx` | DM: enemies |
| `(app)/trees/page.tsx` | DM: class list |
| `(app)/trees/[classId]/page.tsx` | DM: tree editor |
| `(app)/items/page.tsx` | DM: item catalog |
| `(app)/events/page.tsx` | DM: Game Events |
| `(app)/rolls/page.tsx` | Roll log |
| `(app)/sessions/page.tsx` | Session list |
| `(app)/sessions/[id]/page.tsx` | Session note |

## `src/lib`

| File | Role |
| --- | --- |
| `auth.ts` | `getSessionContext`, `requireSession`, `requireDm`, `requirePlayer` |
| `database.types.ts` | Supabase `Database` types and row aliases |
| `supabase/server.ts` | Cookie server client, no-store fetch |
| `supabase/client.ts` | Browser client |
| `skills.ts` | Point budget, node state, tier layout |
| `items.ts` | Effect parse/sanitize, visibility, summaries |
| `rolls.ts` | Expression parse, client RNG, visibility helper |
| `rolls.test.ts` | Rolls contract tests |
| `roll-toast.ts` | Shared toast copy for alerts and local confirm |
| `audit.ts` | Diff `before_data` / `after_data` for Game Events UI |
| `utils.ts` | `cn()` class merge |

## `src/components`

Feature components (not the `ui/` primitives):

| File | Role |
| --- | --- |
| `sidebar.tsx` | Nav + Roll trigger + sign out |
| `roll-trigger.tsx` | Preset dice, custom expression, Public/Private |
| `roll-alerts.tsx` | Realtime INSERT subscription |
| `roll-log.tsx` | Roll history list |
| `character-sheet.tsx` | Tabs: overview, skills, inventory |
| `create-character-dialog.tsx` | Create PC or enemy |
| `coin-purse.tsx` | Gold / silver / bronze fields |
| `skill-tree-panel.tsx` | Spend/refund on a sheet |
| `skill-tree-view.tsx` | Read-only/interactive tree canvas |
| `tree-editor.tsx` | DM skill CRUD and prereq links |
| `class-manager-dialog.tsx` | Create/edit classes |
| `inventory-panel.tsx` | Adjust, transfer, edit effects |
| `items-manager.tsx` | Item catalog CRUD |
| `item-effects-fields.tsx` | Effect list editor |
| `session-note-dialog.tsx` | Create/edit recap notes |
| `audit-log.tsx` | Game Events table |

`src/components/ui/` is shadcn (button, card, dialog, input, tabs, toaster, and so on). Treat those as shared primitives, not domain logic.

## Other `src/`

| File | Role |
| --- | --- |
| `src/proxy.ts` | Auth cookie refresh and login redirects |

## `supabase/migrations`

Versioned SQL applied in timestamp order. See [database.md](database.md) for a one-line index of each file. Do not treat an old migration as the current schema; later files replace RPCs and columns.

## Tests

Only [`src/lib/rolls.test.ts`](../src/lib/rolls.test.ts) today. Run with `npm test`.
