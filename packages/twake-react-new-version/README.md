# twake-react-new-version

Tells the user of a Twake application that the server now serves a newer build than the one running in the tab, and offers to reload the page.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-react-new-version
```

`@linagora/twake-mui`, `twake-i18n`, `react` and `react-dom` are peer dependencies.

## What the app serves

Each build has its own id (the commit in CI, for instance). The app:

- writes it in the bundle, so the running tab knows its own build;
- serves it at `/version.json` as `{ "build": "<id>" }`, with `Cache-Control: no-store`;
- optionally adds patch notes: `{ "build": "<id>", "notes": { "en": "- Faster search\n- Dark mode", "fr": "…" } }`, one text per language code. Entries that are not strings, or only blank space, are ignored, and `notes` is ignored when it is not an object or has no usable entry.

The id must be in the bundle, not read at runtime from a file served next to it: during a rollout a tab may get the bundle of the old server and that file from the new one, and would never be offered a reload.

## Usage

Mount the dialog once, under the app's `I18n` and `TwakeMuiThemeProvider`:

```tsx
import { NewVersionDialog } from '@linagora/twake-react-new-version'

const AppVersion = (): React.ReactElement => (
  <NewVersionDialog running={BUILD_ID} appName="Twake Mail" />
)
```

When a lazy chunk fails to load, the usual sign of a tab older than the served build, ask for a check at once:

```ts
import { requestVersionCheck } from '@linagora/twake-react-new-version'

const ComposerForm = lazy(() =>
  import('./ComposerForm').catch((error: unknown) => {
    requestVersionCheck()
    throw error
  })
)
```

### When it checks

Every 10 minutes, when the tab gets the focus, becomes visible again or comes back online, and on `requestVersionCheck()`. One check at a time, and at most one every 30 seconds but the ones `requestVersionCheck()` asks for: a framed app gets the focus at each click of its host. Never at mount: the page just loaded is the served build (the notes at load, below, are the one read at mount). An error, the network, or an answer that is not that JSON (a dev server answers `index.html`) is no new build.

### What the user sees

A dialog titled « What's new in <appName> », with the text « An update just arrived. Reload to get it. », centred, and « Not now » (a text button) and « Reload » side by side, centred. With `image`, a banner above the title shows the illustration. « Not now », Escape or a click outside decline that build for the life of the tab: the dialog comes back only for a build not declined yet, so a rollback to a declined build is not offered again.

### Patch notes

When `/version.json` has notes for the app language (else `en`), the dialog shows them instead of the usual text. Consecutive lines starting with `- ` are drawn as a list, any other line as text. The zone scrolls (`max-height` 60vh, `overflow-y: auto`) when the notes are long. Without usable notes, the usual text shows. With `notesUrl`, a « See everything that's new » link under the notes opens that page in a new tab.

### Notes at load

With `seenNotesKey`, the dialog also reads `/version.json` once at mount. When it serves the running build with notes the browser has not seen yet, the same dialog shows them with a single « Got it » button (« Compris » in French; Escape and a click outside close it too). A tab open before a deployment still gets the update dialog first.

The browser remembers the notes it has shown, in either dialog, in `localStorage` under `twake-new-version:<seenNotesKey>`: a fingerprint of the notes in every language, not the build. So the same notes in a new build, or in another language, do not show again; new notes do. A browser that has seen none yet shows the notes. A storage that cannot be read shows nothing.

### Props

- `running`: the build id of this bundle
- `appName`: the name shown in the text, such as `Twake Mail`
- `fetchServed()`: reads the served version, `fetchServedVersion` by default. It may answer a `ServedVersion` (`{ build, notes }`), a bare build id string (no notes) or null
- `reload()`: `window.location.reload` by default
- `intervalMs`: time between two checks, 10 minutes by default
- `image`: URL of a decorative illustration (`alt=""`), drawn centred in a full-width banner about 130 px high at the top of the dialog, `object-fit: contain`, cut at the bottom of the banner if taller; no banner without it
- `imageBackground`: CSS colour of the banner, the theme's light primary colour by default (light and dark)
- `seenNotesKey`: a key of the app, such as `twake-mail`, that turns on the notes at load; nothing is read at mount without it
- `notesUrl`: where to read every change, such as the release announcement; a link under the notes, none without it

### Texts

`en`, `fr`, `de`, `es`, `it`, `ru` and `vi`, added to the app's `I18n` under `twakeNewVersion`; English for any other language.

### Detection alone

`fetchServedVersion(url = '/version.json')` (`{ build, notes } | null`, notes null when absent or unusable), `fetchServedBuild(url = '/version.json')` (the build id only), `notesFor(notes, lang)` (the notes in `lang`, else `en`, else null) and `isNewBuild(running, served)` are exported, with the `ServedVersion` type, for an app that wants another surface than the dialog.
