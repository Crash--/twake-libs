# Decisions

Decisions taken on @linagora/twake-app-skeleton, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-25, [Architecture] The loading skeletons of the Twake apps live here, one folder per app

- Decision: the skeleton an app shows while another Twake app loads in a frame (first the Twake Drive picker) lives in this package, one folder and one entry point per app (`@linagora/twake-app-skeleton/drive`), drawn with `@linagora/twake-mui` and the theme only. The Drive one is the `PickerSkeleton` of Twake Calendar ([linagora/twake-calendar-frontend at a87df3f](https://github.com/linagora/twake-calendar-frontend/blob/a87df3fd1425298ceef2d90235242b185c2f8502/common/src/features/Tdrive/components/PickerSkeleton.tsx)), its logotype and icons taken from `@linagora/twake-icons`.
- Decided by: Crash-- (CTO), [Crash--/twake-mail-frontend#1167](https://github.com/Crash--/twake-mail-frontend/issues/1167)
- Why: Mail and Calendar open the same Drive picker and should show the same skeleton while it loads.
- Scope: Twake Mail and Twake Calendar, the Drive picker dialog.
