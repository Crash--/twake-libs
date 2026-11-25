# Decisions

Decisions taken on @linagora/twake-react-new-version, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-25, [Tech] The published ESM loads in Node

- Decision: the package compiles with the `nodenext` module resolution, so every relative import names its `.js` file (`./folder/index.js` for a folder), and JSON is imported `with { type: 'json' }`. `import('@linagora/twake-react-new-version')` works in plain Node once `@linagora/twake-mui` does ([linagora/twake-ui#274](https://github.com/linagora/twake-ui/issues/274)), and apps load the package in Vitest and Jest without transforming it.
- Decided by: Crash-- (CTO), 2026-11-25, [linagora/twake-ui#274](https://github.com/linagora/twake-ui/issues/274)
- Why: Node refuses an ES module import without its extension, so each app had to list the package among the dependencies its tests transform.
- Scope: the build output of the package.

## 2026-11-25, [UX] Pending: the notes show once at load, remembered by their fingerprint

- Options proposed: with `seenNotesKey`, the notes of the running build show at load in the dialog with « Got it » alone, until the browser has seen them; a browser that has seen none shows them; it remembers a fingerprint of the notes in every language (not the build, not the text), so a new build with the same notes or another language does not show them again; notes shown in the update dialog (« Reload », « Not now ») count as seen. Without `seenNotesKey`, nothing changes.
- To decide: Crash-- (CTO). Open: show nothing to a browser that has seen no notes yet.
- Why it matters: a dialog that only reaches the tabs open during a deployment misses most users; remembering the build would show the same notes again at each build that keeps them.
- Scope: every app that passes `seenNotesKey`.

## 2026-11-25, [UX] « Got it » closes the notes shown at load

- Decision: the single button of the notes shown at load reads « Got it » (« Compris », « Verstanden », « Entendido », « Ho capito », « Понятно », « Đã hiểu »), not « Close ». The update dialog keeps « Not now » and « Reload », which also count the notes as seen.
- Decided by: Crash-- (CTO), 2026-11-25, on [linagora/twake-libs#91](https://github.com/linagora/twake-libs/pull/91)
- Why: the user acknowledges what is new rather than dismissing a window.
- Scope: every app that passes `seenNotesKey`.

## 2026-11-25, [UX] A link to every change under the notes

- Decision: with `notesUrl`, the dialog shows a « See everything that's new » link (« Voir toutes les nouveautés ») under the notes, in both dialogs, opened in a new tab. The app passes the URL; nothing in `/version.json`, since the page it points to may only exist after the release is deployed.
- Decided by: Crash-- (CTO), 2026-11-25
- Why: the dialog keeps a few lines; the full list lives elsewhere.
- Scope: every app that passes `notesUrl`.
