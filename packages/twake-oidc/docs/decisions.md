# Decisions

Decisions taken on @linagora/twake-oidc, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-25, [Tech] The published ESM loads in Node

- Decision: the package compiles with the `nodenext` module resolution, so every relative import names its `.js` file (`./folder/index.js` for a folder). `import('@linagora/twake-oidc')` works in plain Node, and apps load the package in Vitest and Jest without transforming it.
- Decided by: Crash-- (CTO), 2026-11-25, [linagora/twake-ui#274](https://github.com/linagora/twake-ui/issues/274)
- Why: Node refuses an ES module import without its extension, so each app had to list the package among the dependencies its tests transform.
- Scope: the build output of the package.
