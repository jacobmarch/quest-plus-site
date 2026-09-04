# Rolls

## Problem Statement

Players and the DM need to roll dice during play from the campaign app itself. They need a default of sharing the result with the whole campaign, and a way to keep a Roll between only that Player and the DM (or DM-only when the DM is rolling). They also need a lasting record of what was rolled so a result can be recounted later.

## Solution

Anyone signed in can roll from a **Roll trigger** in the sidebar footer: one-click single dice or a custom sum of dice and constants. Rolls are saved, then pushed live. **Public Rolls** (the default) appear to every campaign member as a **Roll alert** and in the **Roll log**. **Private Rolls** are stored and pushed with the same rules: only the roller and the DM ever see them; other Players never learn that a Private Roll happened. The full log lives on a **Rolls** tab, not in the sidebar chrome.

## User Stories

1. As a Player, I want a Roll trigger always visible in the sidebar, so that I can roll without opening a character sheet.
2. As a DM, I want the same Roll trigger in the sidebar, so that I can roll without leaving whatever page I am on.
3. As a Player, I want one-click buttons for d4, d6, d8, d10, d12, d20, and d100, so that common single-die rolls are fast.
4. As a DM, I want those same one-click dice, so that I am not stuck using only a text field.
5. As a Player, I want to type a custom expression such as `2d6+3`, so that I can roll several dice and a constant in one Roll.
6. As a DM, I want to type the same kind of custom expression, so that I can roll monster or table dice without leaving the app.
7. As a Player, I want a Public/Private control that defaults to Public, so that sharing with the table is the easy path.
8. As a DM, I want to mark a Roll as Private, so that I can roll behind the screen.
9. As a Player, I want a Private Roll to be visible only to me and the DM, so that other Players cannot see a hidden attempt.
10. As a DM, I want a Private Roll I make to be visible only to me, so that Players never see screen dice.
11. As a Player who did not roll, I want to never see that another Player made a Private Roll, so that there is no table tell.
12. As a Player, I want other Players’ Private Rolls to omit any private marker, so that the UI cannot leak that a secret Roll exists.
13. As a DM, I want to see every Private Roll (mine and Players’), so that I can adjudicate hidden attempts.
14. As a Player, I want my Public Roll to show to every campaign member, so that the table can react together.
15. As a DM, I want my Public Roll to show to every campaign member, so that Players see NPC or world dice I choose to share.
16. As a Player, I want a live Roll alert when a Public Roll I am allowed to see is saved, so that I do not have to refresh to notice it.
17. As a DM, I want a live Roll alert for Public Rolls and for Private Rolls I may see, so that I notice hidden Player Rolls as they happen.
18. As a Player, I want a live Roll alert when I make a Private Roll, so that I get confirmation of my own result.
19. As a Player, I want not to receive a Roll alert for someone else’s Private Roll, so that alerts cannot leak secrets.
20. As a campaign member, I want Roll alerts to be toasts rather than blocking modals, so that I can keep working on the page I am on.
21. As a campaign member, I want each saved Roll to keep the expression, each die face, constants, and the total, so that we can recount what happened if a modifier is applied later.
22. As a campaign member, I want to see who rolled, using their display name, so that a log line is attributable.
23. As a campaign member allowed to see a Roll, I want to see whether that Roll was Public or Private, so that the DM and roller can tell table dice from screen dice.
24. As a Player, I want a Rolls tab in the nav, so that I can read history without crowding the sidebar footer.
25. As a DM, I want the same Rolls tab, so that I am not mixing dice history with Game Events or recap Sessions.
26. As a Player, I want the Roll log to list only Rolls I am allowed to see, so that Private Rolls by others never appear there.
27. As a DM, I want the Roll log to list Public Rolls and all Private Rolls, so that I have a full screen-and-table history.
28. As a campaign member, I want Roll history kept (no auto-delete for now), so that old results stay available for recaps.
29. As a Player, I want an invalid custom expression rejected with a toast and nothing saved, so that a typo does not create a junk Roll.
30. As a DM, I want the same rejection behavior, so that bad input never hits the log.
31. As a campaign member, I want only dice sizes 4, 6, 8, 10, 12, 20, and 100 in expressions, so that the roller matches the preset dice.
32. As a campaign member, I want each term’s die count to be at least 1, so that `0d6` is not a valid Roll.
33. As a campaign member, I want a cap around 100 dice in one Roll, so that a huge typo cannot dump an enormous payload.
34. As a Player, I want to combine several `NdS` terms and constants (for example `1d20+2d6+3`), so that I can express a simple sum without extra syntax.
35. As a Player, I want advantage and keep-highest to stay a table convention (roll twice, keep the higher), so that the expression language stays small.
36. As a Player, I want Rolls not to pull modifiers from character stats, so that this feature does not depend on unused stats UI.
37. As a campaign member, I want a one-click preset to create a Roll of a single die of that size, so that `d20` in the footer means one d20.
38. As a campaign member, I want `2d6+3` to go through the custom field, so that the footer stays compact.
39. As a Player, I want the result computed in the browser and then saved, so that the app stays simple and we are not building an anti-cheat system.
40. As a campaign member, I want the saved row to be the source of truth for the log and for live alerts, so that a toast is never the only record.
41. As a campaign member, I want Realtime to follow the same visibility as the log, so that a live push cannot be leakier than a refresh.
42. As a Player, I want to roll while on Dashboard, My Characters, or Sessions, so that the trigger is truly always available.
43. As a DM, I want to roll while on Party, Bestiary, Skill Trees, Items, Game Events, or Sessions, so that the trigger is truly always available.
44. As a Player, I want the Rolls tab to update when I navigate to it, so that history is complete even if I missed a toast.
45. As a DM, I want the Rolls tab to show older Private Rolls from Players, so that I can look back after the toast is gone.
46. As a campaign member, I want empty history to be an obvious empty state, so that a new campaign is not confusing.
47. As a campaign member, I want newest Rolls first in the log, so that current play is at the top.
48. As a Player, I want to switch Public/Private before rolling, so that I do not accidentally share a hidden attempt.
49. As a Player, I want the Public/Private control to start as Public, so that sharing with the table is the default unless I switch it.
50. As someone not signed in, I want no Roll trigger and no Roll log, so that dice stay inside the campaign.
51. As a Player, I want Game Events to remain the DM audit of sheet and inventory changes, so that dice history is not mixed into that trail.
52. As a Player, I want recap Sessions to remain markdown notes, so that “session” does not start meaning a live table.
53. As a DM, I want to recount a Roll’s faces later if we apply a modifier after the fact, so that we can adjust without re-rolling blindly.
54. As a campaign member, I want constants in the stored breakdown (for example `+3`), so that the total is explainable.
55. As a Player, I want a failed Realtime connection not to block saving a Roll, so that the log still works if live push is down.
56. As a campaign member, I want a Roll alert to include enough of the result to be useful (who, expression, total, faces if space allows), so that I do not have to open the log for every die.
57. As a Player, I want only authenticated campaign members to see Public Rolls, so that this stays a single-campaign table, not the public internet.

## Implementation Decisions

- Add a Rolls area of the product: sidebar Roll trigger, Rolls nav item for Player and DM, Roll log page, and Roll alerts via existing toast UI.
- Persist each Roll as its own record: roller identity, display name at roll time or via profile, Public vs Private, original expression (or preset equivalent), ordered faces, constants, total, and timestamp. Keep all rows; no expiry in this spec.
- Visibility is enforced on read (and on Realtime): Public → every authenticated campaign member; Private → roller and DM; Private by DM → DM only. Other Players get no row, no alert, no private marker.
- Write path: validate expression in the client; if invalid, toast and do not write. If valid, compute faces and total in the client, then persist. Do not add server-side randomness or anti-cheat.
- Allowed custom language: sums of `NdS` and integer constants only; `S` ∈ {4, 6, 8, 10, 12, 20, 100}; `N` ≥ 1; total number of dice in one Roll capped at about 100. Presets are `1dS` for those `S` values.
- After a successful persist, push via Realtime. Realtime is an overlay on the stored row, not a second source of truth. Channel/filters must use the same visibility as the log.
- Enable Realtime for this feature (first live channel in the app). If push fails, the row remains; the roller still gets a local success toast.
- Public/Private toggle defaults to Public on load. Do not attach Rolls to characters or stats.
- Do not reuse Game Events or recap Sessions for the log.
- Follow the existing campaign privacy style (viewer-filtered reads, DM sees more) rather than introducing rooms, presence, or chat.

## Testing Decisions

- **Seam (one):** the Rolls write/read contract — creating a Roll (validation + stored breakdown + visibility flags) and listing/subscribing as a given viewer. UI chrome and toast rendering are not a second seam; they consume this contract. Do not add a separate test suite whose only job is parser internals if create/list already reject bad input and store faces.
- A good test asserts externally visible behavior: which viewer can see which Roll, what is stored (expression, faces, constants, total), rejection of illegal expressions (no row), Public default, Private DM-only vs Player+DM, and that a subscriber only receives Rolls they may see.
- Test the Rolls contract (create + visible list / Realtime payload as the viewer would get it). Do not test React structure, CSS, or that a particular button class exists.
- Prior art: this repo has no automated test runner or existing test files. New tests should sit at this Rolls contract, in whatever first test harness the implementer introduces, rather than scattering UI tests.

If this seam is wrong (for example you would rather treat only a pure expression function as the seam, or only RLS in the database), say so before implementation.

## Out of Scope

- Character-stat modifiers, attack/skill formulas, and any stats UI.
- Advantage, disadvantage, keep-highest/lowest, exploding dice, or other expression grammar beyond sums of `NdS` and constants.
- Presence, “who is at the table,” chat, or turning recap Sessions into live rooms.
- Server-authoritative RNG, signatures, or anti-cheat.
- Auto-deletion, archival, or pagination of the Roll log.
- Revealing a Private Roll later, editing or deleting Rolls, or rolling on behalf of another person.
- Multi-campaign / multi-DM.
- Polling as a substitute for Realtime (Realtime is in scope; polling the whole app is not).

## Further Notes

- Domain language lives in `CONTEXT.md`. Use **Player**, **DM**, **Roll**, **Public Roll**, **Private Roll**, **Roll trigger**, **Roll alert**, and **Roll log**.
- Issue tracker and triage labels were not present in this repo (`docs/agents/issue-tracker.md` is missing). Run `/setup-matt-pocock-skills` if those files should exist before ticketing.
- Next usual step after this spec is `/to-tickets` or implementation, not another grilling pass unless the seam is rejected.
