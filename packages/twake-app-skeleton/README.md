# twake-app-skeleton

The loading skeletons of Twake applications, for the apps that show one of them in a frame: the skeleton fills the frame until the framed app says it is ready. One entry point per app.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-app-skeleton
```

`@linagora/twake-mui`, `@linagora/twake-icons` and `react` are peer dependencies.

## Twake Drive

`DrivePickerSkeleton` is the Drive file picker while it loads: the Twake Drive logotype, the toolbar (the pills of the path, the list and grid views) and rows of files (name, date, size). It fills its box, draws on `background.paper`, and is hidden from assistive technologies: the host says that the picker is loading (a `role="status"` text, `aria-busy` on the frame).

Show it over the frame of the intent until the picker is ready (`readyToUse` of cozy-interapp), under the app's `TwakeMuiThemeProvider`:

```tsx
import { Box } from '@linagora/twake-mui'
import { DrivePickerSkeleton } from '@linagora/twake-app-skeleton/drive'

const FILL_SX = { position: 'absolute', inset: 0 } as const

interface PickerFrameProps {
  isReady: boolean
  /** The box cozy-interapp appends the frame of the intent to */
  frameContainerRef: React.Ref<HTMLDivElement>
}

const PickerFrame = ({
  isReady,
  frameContainerRef
}: PickerFrameProps): React.ReactElement => (
  <Box position="relative" height="100%">
    <Box ref={frameContainerRef} sx={FILL_SX} />
    {isReady ? null : (
      <Box sx={FILL_SX}>
        <DrivePickerSkeleton />
      </Box>
    )}
  </Box>
)
```

The close button stays the host's: the skeleton has none.
