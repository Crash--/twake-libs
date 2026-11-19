# twake-e2e

A fake SSO and sign-in helpers for the end-to-end suites of Twake apps.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install --save-dev @linagora/twake-e2e
```

`@playwright/test` is an optional peer, needed only for the `./playwright` entry point.

## Fake SSO

The fake SSO speaks the OIDC the apps and their backends use: discovery, authorization code with PKCE, userinfo, introspection, logout and back-channel logout. Its sign-in page has one button per person, so a test signs in with a click.

Run it as a container of the end-to-end stack:

```yaml
oidc:
  image: node:24
  command: npx -y @linagora/twake-e2e
  environment:
    ISSUER: https://oidc:8443
    TLS_KEY: /certs/oidc.key
    TLS_CERT: /certs/oidc.crt
    BACKEND_CLIENT_ID: app-backend
    BACKEND_CLIENT_SECRET: secret
    AUDIENCE: app
    BACKCHANNEL_LOGOUT_URI: http://backend:3000/auth/backchannel-logout
```

Or start it from a test:

```ts
import { startFakeSso } from '@linagora/twake-e2e'

const sso = await startFakeSso({
  issuer: 'http://127.0.0.1:8080',
  backend: { clientId: 'app-backend', clientSecret: 'secret' },
  audience: 'app'
})
// ...
await sso.close()
```

- `ISSUER` (`issuer`) is the URL the browser and the backend both reach the SSO at. Without `TLS_KEY` and `TLS_CERT` (`tls`), it is served over plain HTTP.
- `BACKEND_CLIENT_ID` and `BACKEND_CLIENT_SECRET` (`backend`) are the client allowed to introspect tokens. `AUDIENCE` (`audience`) is the `aud` of the access and logout tokens.
- `PEOPLE` (`people`) is a JSON map of usernames to people, `alice` (`ALICE`, an admin) and `bob` (`BOB`) by default. Each one has a `uuid`, a `name`, and optionally an `email` and an `orgRole`.
- `ORGANIZATION` (`organization`) is the `org_id` of everyone, `acme.e2e.test` by default. Empty (`null`), everyone signs in as a B2C user.
- `FRAME_ANCESTORS` (`frameAncestors`) is who may show the SSO's pages in a frame, `'self'` by default.
- `BACKCHANNEL_LOGOUT_URI` (`backchannelLogoutUri`) is where the SSO posts a logout token when a person signs out.

## Playwright

```ts
import {
  asPerson,
  signIn,
  signOutOfTheSso
} from '@linagora/twake-e2e/playwright'

test('alice shares a note with bob', async ({ page, browser }) => {
  await signIn(page, 'alice', {
    signedIn: page => page.getByRole('heading', { name: 'Notes' })
  })
  const bob = await asPerson(browser, 'bob')
  // ...
})
```

- `signIn(page, person)` opens `path` (`/` by default) and clicks the person's button on the SSO's page. With `signedIn`, it waits for what the app shows once they are in.
- `asPerson(browser, person)` signs the person in in a browser context of their own, so each person has their own SSO session. Close it with `page.context().close()`.
- `signOutOfTheSso(page, ssoUrl)` signs the person out of the SSO in another tab, as someone signing out of another app would.
