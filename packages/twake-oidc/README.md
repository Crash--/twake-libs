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

Sign in:

- `startLogin()` sends the user to the SSO.
- `completeLogin()`, on the redirect URI page, exchanges the code for the tokens and resolves to `{ tokenSet, userinfo, returnTo }`, or `null` when no sign-in is pending. `returnTo` is the path the user was on when the sign-in started.
- `getAccessToken()` tells whether this tab holds a session.

Sign out:

- `logOut()` drops the tokens here and in the other tabs, then goes to the SSO logout.
- `onSessionEndedElsewhere(callback)` calls back when another tab signs out.

The tokens are kept in memory only, never in web storage: a reload signs in again through the SSO, silently while the SSO session lasts.

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
