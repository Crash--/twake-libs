# twake-bar

The top bar of the Twake platform for Twake React applications: home button, app title, help link, applications menu and user menu. It reads the platform through `@linagora/twake-sdk` and renders with `@linagora/twake-mui`.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-bar @linagora/twake-sdk
```

`@linagora/twake-mui`, `@linagora/twake-icons`, `twake-i18n`, `react` and `react-dom` are peer dependencies.

## Usage

The host owns the SSO and the theme. It creates the SDK with the user's id token and renders the bar under its providers:

```tsx
import { SdkProvider, TwakeBar, TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import { createSdk } from '@linagora/twake-sdk'

const sdk = createSdk({
  platformURL: `https://${userinfo.workplaceFqdn}`,
  idToken: tokenSet.id_token
})

<TwakeMuiThemeProvider mode={mode}>
  <I18n lang={lang} dictRequire={dictRequire}>
    <SdkProvider client={sdk}>
      <TwakeBar
        app={{ slug: 'calendar', name: 'Calendar', icon: '/icon.svg', textIcon: '/text.svg' }}
        onLogOut={logOut}
      />
      {/* reserve TWAKE_BAR_HEIGHT above the content */}
    </SdkProvider>
  </I18n>
</TwakeMuiThemeProvider>
```

The bar follows the SDK status: an avatar skeleton while it is `waiting`, the menus of the platform once it is `ready`, and off the platform when it is `public`. Locale and theme come from the host's `I18n` and `TwakeMuiThemeProvider`.

### Off the platform

Without a `SdkProvider`, or with a `public` client (no workplace, token exchange refused), the bar has no home button. The host can give what to show instead:

```tsx
<TwakeBar
  app={app}
  onLogOut={logOut}
  fallback={{
    helpLink: 'https://twake.app/support/',
    apps: [{ name: 'Mail', href: 'https://mail.example/', icon: '/mail.svg' }],
    user: { name: userinfo.name, email: userinfo.email }
  }}
/>
```

Each part is optional. With a `fallback`, the account menu always shows, with the log out. A host with its own account menu passes it as `userMenu`, shown in place of the one of the bar, in a `nav` like the other menus; `false` shows no account menu, `null` or no value the one of the bar. The accessible name of that menu and of its trigger is up to the host. The platform data replaces the fallbacks once the client is `ready`.

### Props

- `app`: `slug`, `name`, `icon` URL and optional `textIcon` URL, served by the host. The text icon renders at its intrinsic size, top aligned on the 22px Twake wordmark, so size it against that box and let descenders extend below
- `onLogOut`: called by the log out item, the host ends its SSO session
- `slots`: `left` replaces the home button and title, `center`, `search` fills the middle, `right` is rendered before the menus
- `showEmailDomainChip`: warns when the organization has no mail app yet (default `true`)
- `fallback`: `helpLink`, `apps` and `user` shown off the platform, and `userMenu` to replace the account menu there

### Hooks

`useSdk()`, `useSdkStatus()` and `useSdkData(load)` are exported for host components that need the same platform data.

## TwakeRail

The vertical navigation between the apps, for a host that lays the apps out with a rail at the left of the page on desktop. It keeps `TwakeBar` on small screens.

```tsx
import { TwakeRail } from '@linagora/twake-bar'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', height: '100vh' }}>
    <TwakeRail current="mail" onLogOut={logOut} />
    <main>{children}</main>
  </Box>
)
```

- One link per app of `apps` (registry slugs, `TWAKE_RAIL_APPS` by default: space, drive, chat, mail, calendar, tasks) that the platform has, in that order. A link opens the app in the same tab, and `current` marks the app the rail is in.
- Then the apps menu, help and account menus, which open beside the rail.
- `prerender`: the apps Chrome and Edge prerender when the pointer rests on their link (Speculation Rules), none by default. List an app only when its HTML answers with `Supports-Loading-Mode: credentialed-prerender` and its sign-in waits for the user to reach it, as `@linagora/twake-oidc` does from the version with `waitForActivation()`.
