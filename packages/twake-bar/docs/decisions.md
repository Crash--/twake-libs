# Decisions

Decisions taken on `@linagora/twake-bar`, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Format and categories: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines).

## 2026-11-23, [UX] A navigation rail between the apps, across pages

- Decision: `@linagora/twake-bar` adds `TwakeRail`, a vertical rail of the apps (space, drive, chat, mail, calendar, tasks by default) that each app renders at the left of its page on desktop. A link navigates to the other app in the same tab. Chrome and Edge prerender, through Speculation Rules (`eagerness: moderate`), the apps the host lists in `prerender`, none by default; such an app sends `Supports-Loading-Mode: credentialed-prerender` from its HTML.
- Decided by: Crash-- (CTO), go of 2026-11-23 for the test of the navigation rail across pages
- Why: the rail of the Twake Workplace mockups, tested first as real pages before iframes (study of the workplace navigation, 2026-11-22).
- Scope: desktop. Small screens keep `TwakeBar`.

## 2026-11-23, [Product] Pending: Is the rail on for everyone, or turned on per deployment?

- Options: (a) each app shows the rail only when its deployment turns it on, the top bar otherwise (proposed: Drive, Chat and Space do not render the rail yet); (b) the rail is on as soon as an app ships it.
- To decide: Crash-- (CTO), TAS-145
- Why: a page with the rail next to apps without it breaks the navigation between them.
- Scope: Mail, Tasks and Calendar, desktop.

## 2026-11-23, [UI] Pending: Do the Twake logo and the notification bell of the mockup go in the rail?

- Options: (a) the rail lists the apps, then the apps menu, help and account, with no logo and no bell (as built); (b) add the logo, with a destination to agree, and the bell, once the platform has a notifications service for it.
- To decide: Crash-- (CTO), TAS-145
- Why: the mockup shows both; neither has what it needs yet.
- Scope: `TwakeRail`.
