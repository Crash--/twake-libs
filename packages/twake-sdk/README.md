# twake-sdk

Platform client for Twake applications: exchanges the SSO id token for a cozy-stack token, refreshes it, and gives access to the platform data (apps, instance, flags, shortcuts, intents).

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-sdk
```

## Usage

The host owns the SSO (for example with `@linagora/twake-oidc`) and hands the id token to the SDK:

```ts
import { createSdk } from '@linagora/twake-sdk'

const sdk = createSdk({
  platformURL: `https://${userinfo.workplaceFqdn}`,
  idToken: tokenSet.id_token
})

sdk.status // 'waiting' while the token is exchanged, then 'ready'
sdk.onStatusChange(status => render(status))

await sdk.login(renewedIdToken) // when the host renews its id token
sdk.logout() // forgets the tokens, the SSO end_session revokes the OAuth client
```

Requests go to the platform with the bearer token. A 401 refreshes the token once and retries:

```ts
const response = await sdk.fetch('/files/io.cozy.files.root-dir')
const root = await sdk.fetchJSON<RootDir>('/files/io.cozy.files.root-dir')
```

Platform data, loaded once per page:

```ts
const apps = await sdk.getApps() // without the apps hidden by the `apps.hidden` flag
const instance = await sdk.getInstance() // email, public_name, diskUsage, diskQuota
const flags = await sdk.getFlags()
const shortcuts = await sdk.getShortcuts() // Home shortcuts
const icon = await sdk.getAppIconURL('drive') // blob URL, revoked by logout
const settings = await sdk.getAppURL('settings', '#/profile') // client URL for standalone apps
const intent = await sdk.createIntent({ action: 'PICK', type: 'io.cozy.files' })
```

The libraries made for cozy-client take the SDK as their client: `stackClient.fetchJSON(method, path, body)` sends the body as JSON.

```ts
import Intents from 'cozy-interapp'

const intents = new Intents({ client: sdk })
```

Tokens stay in memory: a reload exchanges the id token again.

## Platform requirements

`token_exchange` succeeds when the host requests the `workplaceFqdn` scope, the stack context lists the host's SSO client in `oidc.app_token_exchange`, and the host's container app is installed from the registry.

The first login of a page reads the container app, so the platform updates it from the registry like it does when it serves an app. An update that changes the permissions only goes through when the context lists the container app in `additional_platform_apps`.
