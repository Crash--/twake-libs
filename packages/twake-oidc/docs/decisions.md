# Decisions

Decisions taken on `@linagora/twake-oidc`, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Format and categories: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines).

## 2026-11-23, [Tech] twake-oidc signs in only once a prerendered page is shown

- Decision: `startLogin()` and `signInSilently()` of `@linagora/twake-oidc` wait until the user goes to a page the browser prerenders, and `waitForActivation()` lets an app with a sign-in of its own do the same. The PKCE state stays in `sessionStorage`.
- Decided by: Crash-- (CTO), go of 2026-11-23 for the test of the navigation rail across pages
- Why: the rail prerenders the next app. Measured in Chrome 156 on a disposable stack: the silent sign-in frame is held back until the click, so it timed out and a redirect sign-in looped; the redirect to the SSO did not keep the `sessionStorage` written before it.
- Scope: every app on `@linagora/twake-oidc`. Keeping the PKCE state in `localStorage`, so that the sign-in ends during the prerender, is proposed apart and not decided.
