# Quest Plus — developer docs

Documentation for this repository: as-built architecture plus feature specs. It describes the campaign manager as the code works today: one campaign, one **DM**, many **Players**.

Use the glossary in [`CONTEXT.md`](../CONTEXT.md) (**Player**, **DM**, **Roll**, **Public Roll**, **Private Roll**, **Roll trigger**, **Roll alert**, **Roll log**). New feature specs are published here (`docs/<feature>.md`) via `/to-spec`, using the same template as [rolls.md](rolls.md).

Setup, environment variables, and scripts: [`README.md`](../README.md).

## Contents

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Stack, request flow, layouts, where reads and writes go |
| [codebase-map.md](codebase-map.md) | Directory and file inventory |
| [auth-and-roles.md](auth-and-roles.md) | Signup, first-user DM, proxy, session helpers, RLS roles |
| [routes.md](routes.md) | App Router pages and Player vs DM navigation |
| [server-actions.md](server-actions.md) | Catalog of `src/app/actions.ts` |
| [characters.md](characters.md) | PCs, enemies, sheets, party, bestiary |
| [skills.md](skills.md) | Classes, trees, unlock/lock, point budget |
| [items-and-inventory.md](items-and-inventory.md) | Catalog, inventory RPCs, hidden effects, coin purse |
| [rolls.md](rolls.md) | Spec + as-built: trigger, alerts, log, client RNG, Realtime |
| [sessions-and-events.md](sessions-and-events.md) | Recap notes vs Game Events audit trail |
| [database.md](database.md) | Tables, RPCs, RLS, migrations |
| [testing.md](testing.md) | Vitest and the Rolls contract tests |
