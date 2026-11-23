# jwt

Decode-only JWT helpers. **No signature verification.**

```ts
import {
  decodeJwtPayload,
  getJwtStringProperty
} from '@linagora/twake-crypto-utils'
```

## Warning

`decodeJwtPayload` does **not** verify the JWT signature. Only use it on tokens received over a trusted channel:

- a direct back-channel call to your IdP's token endpoint over HTTPS
- your own session store
- a service-to-service call inside a trusted boundary

For tokens from untrusted sources (browser-supplied bearer tokens, third-party webhooks), use a JWT verification library like [`jose`](https://github.com/panva/jose). This helper does not exist to short-cut that.

## `decodeJwtPayload(token)`

```ts
const payload = decodeJwtPayload(token)
// payload: Record<string, unknown> | null
```

Returns `null` on malformed tokens (wrong segment count, non-base64url payload, non-JSON body). Doesn't throw.

## `getJwtStringProperty(payload, key)`

Safely read a string claim from a decoded payload.

```ts
const sub = getJwtStringProperty(payload, 'sub') // string | undefined
```

Returns `undefined` if `payload` is `null`, the key is missing, or the value is not a string (number, boolean, array, object, null, undefined all return `undefined`).

## Example

```ts
const payload = decodeJwtPayload(idTokenFromIdP)
const sub = getJwtStringProperty(payload, 'sub')
const email = getJwtStringProperty(payload, 'email')
if (!sub) throw new Error('id_token missing sub')
```

## See also

- [encoding](./encoding.md) - `base64UrlDecode` is what the JWT payload decoder uses internally.
