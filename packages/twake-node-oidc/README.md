# twake-node-oidc

Checks the SSO access tokens a Twake Node backend receives, ends sessions on the SSO's back-channel logout, and gets the backend's own access token (client credentials) to call other services.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-node-oidc
```

`fastify` and `drizzle-orm` are optional peers, needed only for the `./fastify` and `./drizzle` entry points.

## Usage

```ts
import Fastify from "fastify";
import { connectOidc } from "@linagora/twake-node-oidc";
import { drizzleAuthStore } from "@linagora/twake-node-oidc/drizzle";
import { identityOf, registerOidc } from "@linagora/twake-node-oidc/fastify";

const oidc = await connectOidc({
  issuer: new URL(process.env.OIDC_ISSUER),
  clientId: "twake-tasks-backend",
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  audience: "twake-tasks",
  store: drizzleAuthStore(db),
});

const app = Fastify();
const requireIdentity = registerOidc(app, oidc);

app.get("/me", { preHandler: requireIdentity }, (request) =>
  identityOf(request),
);
```

`requireIdentity` answers:

- 401 with `WWW-Authenticate: Bearer` when the request has no bearer token, and `Bearer error="invalid_token"` when the SSO refuses it or its session was logged out.
- 503 when the SSO cannot be reached, or when too many unknown tokens are already waiting for a check.

Otherwise it puts the caller on `request.identity`:

```ts
interface Identity {
  subject: string;
  userId: string; // the LDAP entryUUID
  email: string;
  name: string | null;
  sessionId: string;
  expiresAt: Date;
  organizationId: string | null; // null for a B2C user
  organizationRole: "owner" | "admin" | "moderator" | "member" | null;
}
```

## How a token is checked

- The token is introspected and the userinfo fetched in parallel. It must be active, unexpired, carry `audience` in its `aud`, and its userinfo must hold `sub`, `sid`, `uuid` and `email`.
- An accepted token is kept for 60 seconds, or until it expires if sooner. A refused one is remembered for 60 seconds, so sending it again does not reach the SSO.
- Requests sent together with the same new token share one check. At most `newTokenChecks` (10) unknown tokens are checked at once, `newTokensWaiting` (100) more wait, and the rest get a 503. Tokens seen before never wait.
- The client credentials go in a raw Basic header, which every LemonLDAP version reads. An `http:` issuer is accepted, for a local stack.

## Back-channel logout

`registerOidc` adds `POST /auth/backchannel-logout`, under the prefix of the Fastify context it is given. Register that URL as the back-channel logout URI of the SSO client the frontend signs in with, whose client id is `audience`: the logout token carries it in `aud`. A valid logout token revokes its `sid` for 24 hours, and every token of that session is then refused, even one already kept.

Where revocations live:

- `drizzleAuthStore(db)` keeps them in the `oidc_revoked_sessions` table, so every replica sees them. Export `oidcRevokedSessions` from the service's drizzle schema so its migrations create the table.
- `memoryAuthStore()` keeps them in the process, for a single replica or tests.
- Anything implementing `AuthStore` (`isRevoked`, `revoke`) works too.

## Service token

`discoverServiceToken` gets an access token for the backend's own SSO client (client credentials), to call another service as itself:

```ts
import { discoverServiceToken } from "@linagora/twake-node-oidc";

const serviceToken = await discoverServiceToken({
  issuer: new URL(process.env.OIDC_ISSUER),
  clientId: "twake-chat-side-service",
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  scope: "openid", // LemonLDAP refuses a client credentials request without one
});

const authorization = `Bearer ${await serviceToken.getToken()}`;
```

- A token is kept until 30 seconds before it expires, or for half its life when it lives less than a minute. Without `expires_in`, it counts as a 60 second token.
- Calls made while a token is being requested share that request.
- `forget(token)` drops a token the called service refused, so the next `getToken()` asks for a new one. A token that replaced it meanwhile is kept.
- An answer without `access_token` rejects with an error naming the field.
- The client id and secret go in a raw Basic header, as LemonLDAP before 2.23 expects. From 2.23, which URL-decodes them, a `%` in either is misread.

## Tests

`@linagora/twake-node-oidc/testing` stands in for the SSO in route tests:

```ts
import { anIdentity, fakeOidc } from "@linagora/twake-node-oidc/testing";

const requireIdentity = registerOidc(
  app,
  fakeOidc((token) => (token === "alice" ? anIdentity() : null)),
);
```
