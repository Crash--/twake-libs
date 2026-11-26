# Decisions

Decisions taken on @linagora/twake-bar, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-25, [UI] One "?" for the help of the platform and of the app

- Decision: the bar shows one help button. The help page of the platform (`help_link`, or `fallback.helpLink`) and the entries the host gives in `helpItems` (its support, a bug report) open at once when there is one, else from a menu like the other menus of the bar, "Help center" first.
- Decided by: Crash-- (CTO), [Crash--/twake-mail-frontend#1168](https://github.com/Crash--/twake-mail-frontend/issues/1168)
- Why: an app adding its own help in the `right` slot showed two identical "?" side by side.
- Scope: every app using twake-bar; Twake Mail first.
