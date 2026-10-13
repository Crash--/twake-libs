# twake-embed

The contract between TwakeSpace and the apps it frames in the tabs of a space
(ADR 010 of twake-space-architecture): the browser history, the messages, and
the overlay the app draws its dialogs and windows on.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-embed
```

## The rule

The page and its frames share one browser history, and TwakeSpace owns it. In
a frame the app never adds an entry and never navigates its own document after
its boot: `pushState` becomes `replaceState`, every change of the frame's URL
is reported to TwakeSpace, and TwakeSpace moves the frame with `load` (another
resource) and `navigate` (Back, Forward, a deep link).

Measured in Chromium, Firefox and WebKit: a removed frame keeps its history
entries as dead Back presses in Chromium and WebKit, a frame that only
replaces adds none, and Chromium reloads a frame to the document it had when
the page goes back to an entry recorded before the frame navigated.

## In the app

Connect as soon as the app knows it is framed, even on the callback page of
its silent login, and sync the history once its router exists. The app does
not need TwakeSpace's address: TwakeSpace greets the frame
(`twake-embed:hello`) on each of its loads and whenever the app says it is
listening (`twake-embed:ready`, posted to whoever framed it, since the app
may boot after the frame's load), and the app answers the origin that
greeted it. Only a page the app's `frame-ancestors` allows can be that
parent, so that header stays mandatory, and it is where the address of
TwakeSpace belongs, in the deployment of the app. `hostOrigins` restricts the
hosts further when an app wants to.

```ts
import { connectToTwakeSpace, embedRoute } from '@linagora/twake-embed'

const space = connectToTwakeSpace({ embedPrefix: '/embed/projects/' })
// null when not framed

const stop = space?.syncHistory({
  // Show another resource at `path`, in place; or, until the app can,
  // location.replace(embedRoute('/embed/projects/', resourceId) + path)
  onLoad: (resourceId, path) =>
    router.navigate(embedRoute('/embed/projects/', resourceId) + path, {
      replace: true
    }),
  // Show `path` within the resource shown
  onNavigate: (resourceId, path) =>
    router.navigate(embedRoute('/embed/projects/', resourceId) + path, {
      replace: true
    })
})
```

`path` is '' on the embed route itself, otherwise the rest of the URL below
it, starting with `/`, `?` or `#`; a `//` or a `\\` in its pathname is refused. Nothing a handler writes to the URL is
reported while its promise is pending. Pass `isResourceId` to refuse ids that
do not look like the app's.

An app with a hash router (Twake Drive, served by cozy-stack, which knows no
other path than its files) passes `hashRouting: true`: its embed route is read
from the hash, and TwakeSpace frames `/#<prefix><resource id>`.

The silent login (`prompt=none`) runs at boot with `location.replace`;
renewals use a refresh token or a nested frame. When the login is refused:

```ts
space?.notifyLoginRequired()
```

Two ways to grow, not to be confused:

- **The page of TwakeSpace.** An app TwakeSpace allows to (Chat, for its
  calls) can take the whole page of TwakeSpace and give it back. TwakeSpace
  makes the frame cover its page and the rest of it inert:

  ```ts
  space?.fillPage(true)
  ```

- **The browser's full screen.** The app asks the browser itself, from a user
  gesture, for one of its elements or its whole document, as a video player
  does. It works in a frame only if TwakeSpace granted it with
  `allow="fullscreen"` on the frame:

  ```ts
  import { canGoFullscreen, requestFullscreen, exitFullscreen } from '@linagora/twake-embed'

  if (canGoFullscreen()) await requestFullscreen(player)
  ```

The call window: an app that holds a link to a call (a Meet room in an event,
in a message) asks TwakeSpace to open it in its own call window, floating
over its page, instead of a new tab. TwakeSpace opens the rooms of its Meet
only, and drops anything else:

```ts
space?.openPip(meetingUrl)
```

The overlay: TwakeSpace frames `<app url>/embed/overlay.html`, an empty page
of the app's origin, next to the app's frame and named after it. The app
renders its dialogs and docked windows into it with `@linagora/twake-mui`
(`SpaceOverlayProvider`, `connectSpaceOverlay`), and reports where it draws:

```ts
space?.reportOverlayRegion(region)
```

The badges: a count TwakeSpace shows on the app's tab (unread mail, unread
notifications), and adds up per space in its list of spaces. One frame of the
app serves every space, so the app reports the counts of every resource it
knows, the one shown or not, keyed by the resource id of its embed route.
Each call replaces the previous counts; 0, or a resource left out, shows
nothing. Report again whenever a count changes:

```ts
space?.reportBadges([
  { resourceId: 'mbx-1', count: 3 },
  { resourceId: 'mbx-2', count: 0 }
])
```

The metadata: what the app knows of its resources, shown by TwakeSpace on
the tabs and the home of each space: the count on the tab (`badge`), the
tasks done in a project, the files of a drive. Like the badges, the entries
are keyed by resource id, cover every resource the app knows, and each call
replaces the previous ones; an entry left out is not known yet. The names are
agreed with TwakeSpace, lowercase and dotted; a value is a whole number or a
short text. Once an app reports metadata, TwakeSpace reads its tab counts from
the `badge` entries, and `reportBadges` is only for TwakeSpace builds that do
not read metadata yet:

```ts
space?.reportMetadata([
  { resourceId: 'p1', name: 'badge', value: 3 },
  { resourceId: 'p1', name: 'tasks.done', value: 12 },
  { resourceId: 'p1', name: 'tasks.total', value: 20 }
])
```

The notifications: a frame of another origin may not show a notification of
the system, the browser refuses it even when the app has the permission.
TwakeSpace shows it for the app (Chat, for a call that rings). One per tag: a
new one with the same tag replaces it. `resourceId`, the resource it is about
(as in the badges), tells TwakeSpace which space a click opens; without it,
the space the frame shows. Close it when what it told is over:

```ts
space?.notify({
  tag: 'call:!room',
  title: 'Alice',
  body: 'is calling you',
  resourceId: '!space'
})
space?.closeNotification('call:!room')
```

Links leaving the frame open in a new tab, and the frame stays on the app:

- On once the app is connected; `connectToTwakeSpace({ interceptExternalLinks: false })` turns it off.
- A user caused navigation (a click, a form, a script on a click) to an http(s) page that is not below the embed route is redirected to `window.open` with `noopener,noreferrer`.
- Left alone: the silent login and its renewals (`location.replace`, no user activation), downloads, fragments of the page, `pushState`, traversals, form posts.
- It listens to `navigate` (Navigation API) and also guards clicks and form submits: Firefox and WebKit do not fire `navigate` for a link or form to another origin.
- Links to another origin are caught before the handlers of the app, so a component that stops the click cannot hide them. A same-origin link the app handles with `preventDefault` is left to the app.
- TwakeSpace gives the frame `allow-popups-to-escape-sandbox`, so the new tab is a normal page.

## In TwakeSpace

```ts
import { helloMessage, parseAppMessage, loadMessage, navigateMessage, embedUrl } from '@linagora/twake-embed'
```

TwakeSpace posts `helloMessage()` to a frame on each of its `load` events
and in answer to its `twake-embed:ready`, with the app's origin as target. `parseAppMessage` reads what a frame sends,
once the origin and the source window are checked; a `twake-embed:badges`
message holds the app's counts by resource id, a `twake-embed:metadata`
message its metadata by resource id and name (its counts too, under `badge`,
which then win over its `badges`), and a `twake-embed:pip`
message a call the app asks TwakeSpace to open in its call window, to check
against its Meet before it does. `embedUrl` builds the frame's `src` for a resource at a
path, and refuses a path that leaves the embed route.
