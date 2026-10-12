# twake-feedback

One draggable feedback button, the Sentry User Feedback wiring and the translated labels, shared by the Twake applications. The form itself (message, screenshot, annotations, submit) stays Sentry's: the button only opens it.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-feedback @sentry/react
```

`@linagora/twake-mui`, `@linagora/twake-icons`, `twake-i18n`, `react` and `react-dom` are peer dependencies. `@sentry/react` (`^11.4.0`) is an optional peer dependency: it is only imported by `@linagora/twake-feedback/sentry`, so an app that plugs the button on something else never loads it.

## Usage

The app creates the integration in `Sentry.init`, then renders the button under its `I18n` and `TwakeMuiThemeProvider`:

```tsx
import * as Sentry from '@sentry/react'
import { FeedbackButton, getFeedbackLabels } from '@linagora/twake-feedback'
import {
  attachFeedback,
  makeFeedbackIntegration
} from '@linagora/twake-feedback/sentry'

const feedback = makeFeedbackIntegration()

Sentry.init({ dsn, integrations: [feedback] })

const AppFeedback = ({ lang }: { lang: string }) => {
  // Memoized: a new function detaches the form and closes it if it is open
  const attach = useCallback(
    (el: HTMLElement) => attachFeedback(feedback, el, getFeedbackLabels(lang)),
    [lang]
  )

  return <FeedbackButton attach={attach} storageKey="twake-space" />
}
```

`makeFeedbackIntegration(overrides?)` returns `Sentry.feedbackIntegration` with `autoInject: false`, `enableScreenshot: true`, `showBranding: false`, `showName: false`, `showEmail: true` and `isEmailRequired: false`. `overrides` are any other `feedbackIntegration` options and win over these defaults.

`attachFeedback(integration, el, labels?)` calls `integration.attachTo(el, labels)` and returns its detach function, which also removes the form.

### Props of `FeedbackButton`

- `attach(el)`: plugs the form on the button element and returns the function detaching it. The component never imports Sentry, so the app decides what it calls
- `storageKey`: suffix of the `localStorage` key `twake-feedback:<storageKey>` keeping `{ side, bottom }`
- `bottomOffset`: extra px kept free at the bottom, for instance above a mobile bottom bar (default `0`)
- `onSideChange(side)`: called with `'left'` or `'right'` on mount and when the button changes side
- `styleNonce`: CSP nonce of the style element described below

### Labels

`getFeedbackLabels(lang)` returns the texts of Sentry's form for `en`, `fr`, `de`, `es`, `it`, `ru` and `vi` (`fr-FR` reads as `fr`), English for any other language. The button and its menu read the language from the `I18n` of the app.

## Moving the button

Drag it (past 5 px, otherwise it is a click): it follows the pointer, stays in the viewport and snaps to the nearest left or right edge on release, keeping its height. The position is stored and restored, and kept in the viewport when the window is resized. A click ending a drag does not open the form.

The Sentry form opens on the same side, at the same height: the component keeps a `<style id="twake-feedback-position">` setting `--inset` on `#sentry-feedback`, and removes it on unmount.

## Accessibility

- The button is a native `button` named by its visible label ("Something wrong?"), described by a tooltip, reachable with the keyboard
- Dragging is never required: the context menu key, `Shift+F10` (`aria-keyshortcuts`), a right click or a long press with a finger open a menu with "Move to the left", "Move to the right" and "Reset position"
- The button is above the MUI modals, drawers and their backdrops (`zIndex.modal + 1`), so it stays usable while a dialog is open, and below snackbars and tooltips

## Content Security Policy

Only Sentry's synchronous integration is used: no web worker and no script loaded from a CDN. The `<style>` element placing the form is an inline style: with a strict `style-src`, give the CSP nonce with `styleNonce` (Sentry's own `styleNonce` option is a separate setting).
