# Testing

Runner: **Vitest** (`npm test` → `vitest run`). Config: [`vitest.config.ts`](../vitest.config.ts) — Node environment, files `src/**/*.test.ts`, `@/` → `src/`.

There is no Playwright or React Testing Library suite. Do not add tests that only assert CSS classes or component tree shape.

## Rolls contract

Spec: [rolls.md](rolls.md). [`src/lib/rolls.test.ts`](../src/lib/rolls.test.ts) is the seam:

- Legal vs illegal expressions (`parseDiceExpression`) — no row would be written on failure
- Stored breakdown: faces, net constant, total (`rollParsed` with a seeded RNG)
- `evaluateDiceExpression` does not roll illegal input
- `canViewerSeeRoll`: Public vs Player Private vs DM Private

UI (trigger chrome, toast rendering) is not a second seam; it consumes this contract plus RLS on `rolls`. Database RLS is not executed in Vitest; keep SQL visibility aligned with `canViewerSeeRoll`.
