# Quest Plus

Campaign manager for a custom D&D spin-off: one campaign, one DM, many players. Not a live virtual tabletop.

## Language

**Player**:
An authenticated campaign member whose role is player.
_Avoid_: user, client

**DM**:
The campaign’s dungeon master. There is one DM.
_Avoid_: GM, admin (when meaning the table role)

**Roll**:
One recorded outcome of preset dice and/or a custom dice expression, including a total. Not tied to character stats.
_Avoid_: check, throw

**Public Roll**:
A Roll visible to every authenticated campaign member. This is the default.
_Avoid_: broadcast, shout

**Private Roll**:
A Roll visible only to the roller and the DM. If the DM is the roller, only the DM can see it. Other Players never learn that it happened.
_Avoid_: whisper, secret check, opaque roll

**Roll trigger**:
Always-present chrome for making a Roll, without opening the Roll log.

**Roll alert**:
A short-lived notice, pushed live, that a new Roll the viewer is allowed to see has happened. Same visibility as the Roll log: never a leak of Private Rolls.

**Roll log**:
Persisted history of Rolls a given viewer is allowed to see, shown on its own tab—not in the trigger chrome.
_Avoid_: chat, session (this is not a live table or a recap note)
