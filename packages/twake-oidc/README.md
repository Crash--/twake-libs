# twake-oidc

SSO sign-in (OIDC authorization code + PKCE) and session handling for Twake applications.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-oidc
```

## Usage

Configure once, before the application renders:

```ts
import { configureAuth } from '@linagora/twake-oidc'

configureAuth({
  ssoUrl: window.SSO_BASE_URL,
  clientId: window.SSO_CLIENT_ID,
  scope: window.SSO_SCOPE,
  redirectUri: window.SSO_REDIRECT_URI,
  postLogoutRedirectUri: window.SSO_POST_LOGOUT_REDIRECT,
  apiUrl: window.MY_BACKEND_URL
})
```

`readAuthConfig(window, window.MY_BACKEND_URL)` builds the same config from the `SSO_*` settings of `/env.js`, for an app that declares them on `Window`, and throws naming the ones that are missing.

Then sign the user in as the application starts:

```ts
import { relayCallback, resumeSession } from '@linagora/twake-oidc'

if (!relayCallback()) {
  const login = await resumeSession()
  if (login) render(login.userinfo)
}
```

- `relayCallback()` is true in the hidden frame or popup the sign-in opens, once the SSO's answer reaches it: it hands the answer to the page that opened it, which then renders nothing.
- `resumeSession()` finishes the sign-in on the redirect URI page and goes back to the path it started from. Elsewhere it reuses the SSO session through a hidden frame, so the page never leaves while the SSO session lasts. Otherwise it sends the user to the SSO and resolves to `null`.

Twake apps make their HTTP calls with [ky](https://github.com/sindresorhus/ky). Its hooks hand the token to the backend, and sign in again when it answers 401 (ky then rejects the request with an `HTTPError`):

```ts
import ky from 'ky'
import { addAuthorization, redirectOnUnauthorized } from '@linagora/twake-oidc'

export const api = ky.create({
  prefixUrl: window.MY_BACKEND_URL,
  hooks: {
    beforeRequest: [addAuthorization],
    afterResponse: [redirectOnUnauthorized]
  }
})
```

Without ky, `fetchSignedIn(request)` runs both hooks around one `fetch`.

Sign in:

- `startLogin()` sends the user to the SSO.
- `signInSilently()` signs in through a hidden frame that asks the SSO to show nothing (`prompt=none`). It rejects with a `LoginRequiredError` when the SSO needs the user, and after 10 seconds without an answer.
- `signInWithPopup()` signs in through a popup where the SSO shows its portal. Call it from a click handler, so the browser allows the popup.
- `completeLogin()`, on the redirect URI page, exchanges the code for the tokens and resolves to `{ tokenSet, userinfo, returnTo }`, or `null` when no sign-in is pending. `returnTo` is the path the user was on when the sign-in started.
- `getAccessToken()` tells whether this tab holds a session.
- `getIdToken()` gives the ID token of the session, e.g. for the token exchanges of other Twake apps.

Sign out:

- `logOut()` drops the tokens here and in the other tabs, then goes to the SSO logout. It hands the ID token of the session to the SSO as `id_token_hint`: LemonLDAP::NG then skips its confirmation page for a client with "Bypass logout confirmation" set (`oidcRPMetaDataOptionsLogoutBypassConfirm`), when the token belongs to the current SSO session (same `sub` and `sid`). Without an ID token, as in a tab whose session ended elsewhere, the SSO asks the user to confirm. The hint is a query parameter of the logout URL, so the ID token lands in the browser history and in the access logs of the SSO and of the proxies in front of it.
- `onSessionEndedElsewhere(callback)` calls back when another tab signs out.

The tokens are kept in memory only, never in web storage: a reload signs in again through the SSO, silently while the SSO session lasts.

The SSO must be served over HTTPS, except on a `localhost` or `*.localhost` host, for local and QA stacks.

## Behind a relaying backend

An SSO that only accepts exact redirect URIs cannot list every host of an application served on many hosts. The redirect URI is then the backend, which relays the SSO's answer to the page. Give `relayState`, the values the backend needs to find the page:

```ts
configureAuth({
  // ...
  redirectUri: `${window.MY_BACKEND_URL}/oidc/callback`,
  relayState: () => ({ origin: window.location.origin })
})
```

- The state is base64url JSON of these values plus a random `nonce`. The backend decodes it and redirects to the page with the same query.
- `completeLogin()` runs on the page the backend sends the user to. The token request still names the redirect URI the SSO sent the code to.
- The backend must check each value against its own allow list: the state comes back through the browser.

## In a frame of Twake Space

An app shown in a frame of another app (Twake Space, ADR 010 of twake-space-architecture) cannot show the SSO portal: the SSO may refuse to be framed. Give `framed`, a boolean or, for an app framed on some routes only, a function read at each sign-in:

```ts
configureAuth({
  // ...
  framed: () => window.location.pathname.startsWith('/embed/'),
  onLoginRequired: () => twakeSpace?.notifyLoginRequired()
})
```

Framed:

- `startLogin()` asks the SSO to show nothing (`prompt=none`) and leaves with `location.replace`, so the frame adds no entry to the history it shares with the page around it.
- `completeLogin()` rejects with a `LoginRequiredError` when the SSO answers that it needs the user (`login_required`, `interaction_required`, `consent_required`, `account_selection_required`). Its `returnTo` is the path the sign-in started from. The app shows that the session expired and tells the page around it, which signs the user in at the top level.
- On a 401 from the backend, `redirectOnUnauthorized` never navigates the frame: it calls `onLoginRequired` once instead.
- `getPendingReturnTo()` tells, on the callback page, which path a pending sign-in comes back to, without finishing it.
- `resumeSession()` rejects with the `LoginRequiredError` of its silent sign-in, rather than asking the SSO the same question again through `startLogin()`.
- `signInWithPopup()` lets the user sign in from the frame itself, since the popup is a window of its own.
