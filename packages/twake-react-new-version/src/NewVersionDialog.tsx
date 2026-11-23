import React, { useEffect, useId, useRef, useState } from 'react'

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  dialogTitleClasses
} from '@linagora/twake-mui'
import { useExtendI18n, useI18n } from 'twake-i18n'

import { PatchNotes } from './PatchNotes'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import {
  CHECK_VERSION_EVENT,
  fetchServedVersion,
  isNewBuild,
  notesFor,
  type ServedVersion
} from './version'

const locales: Record<string, typeof en> = { de, en, es, fr, it, ru, vi }

const MINUTE = 60_000
const MIN_GAP_MS = 30_000

export interface NewVersionDialogProps {
  /** The build id of this bundle, the one `/version.json` names once served */
  running: string
  /** The name shown in the text, such as `Twake Mail` */
  appName: string
  /** Reads the served version; a bare string is a build without notes. `fetchServedVersion` by default */
  fetchServed?: () => Promise<string | ServedVersion | null>
  reload?: () => void
  intervalMs?: number
  /** URL of a decorative illustration, drawn in a banner at the top */
  image?: string
  /** CSS colour of the banner, the theme's light primary by default */
  imageBackground?: string
}

/**
 * Runs `check` every `intervalMs`, and whenever the tab may have missed a
 * deployment: it gets the focus, becomes visible again, comes back online, or
 * the app asks for it (`requestVersionCheck`). Not at mount: the page just
 * loaded is the served build. One check at a time, and at most one per
 * `MIN_GAP_MS` but the ones the app asks for: a framed app gets the focus at
 * each click of its host
 */
const useVersionChecks = (
  check: () => Promise<void>,
  intervalMs: number
): void => {
  // The listeners stay in place while `check` changes with each render
  const latestCheck = useRef(check)
  latestCheck.current = check
  // Refs, not effect locals: the guard holds when `intervalMs` changes
  const isRunning = useRef(false)
  const lastRun = useRef(-Infinity)

  useEffect(() => {
    const run = (isAsked = false): void => {
      const now = Date.now()
      if (isRunning.current) return
      if (!isAsked && now - lastRun.current < MIN_GAP_MS) return
      isRunning.current = true
      lastRun.current = now
      void latestCheck.current().finally(() => {
        isRunning.current = false
      })
    }
    const onEvent = (): void => run()
    const onAsked = (): void => run(true)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') run()
    }
    const timer = window.setInterval(onEvent, intervalMs)
    const events = ['focus', 'online']
    events.forEach(name => window.addEventListener(name, onEvent))
    window.addEventListener(CHECK_VERSION_EVENT, onAsked)
    document.addEventListener('visibilitychange', onVisible)
    return (): void => {
      window.clearInterval(timer)
      events.forEach(name => window.removeEventListener(name, onEvent))
      window.removeEventListener(CHECK_VERSION_EVENT, onAsked)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
}

/**
 * Decorative banner at the top of the dialog. The small dialog of twake-mui
 * pads its paper by 8 px on each side below `lg`: the banner cancels that
 * margin there, to reach the edges of the paper (which clips it to its rounded
 * corners). The image is taller than the banner (120%) and anchored at its top,
 * so its bottom is cut. Without `background`, the tint is the light primary,
 * a dimmed primary in the dark scheme where the light one glares
 */
const Banner = ({
  image,
  background
}: {
  image: string
  background?: string
}): React.ReactElement => (
  <Box
    sx={theme => ({
      height: 130,
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      [theme.breakpoints.down('lg')]: { marginInline: -1 },
      backgroundColor:
        background ??
        theme.vars?.palette.primary.light ??
        theme.palette.primary.light,
      ...(background === undefined &&
        theme.applyStyles('dark', {
          backgroundColor: theme.alpha(
            theme.vars?.palette.primary.main ?? theme.palette.primary.main,
            0.16
          )
        }))
    })}
  >
    <img
      src={image}
      alt=""
      aria-hidden
      style={{
        height: '120%',
        marginTop: 6,
        flexShrink: 0,
        objectFit: 'contain'
      }}
    />
  </Box>
)

/**
 * « New version available »: offers a reload to a tab that runs an older
 * build than the served one. « Not now », Escape or a click outside decline
 * that build for the life of the tab: the dialog comes back only for a build
 * not declined yet. Mount it once, under the app's `I18n` and twake-mui theme
 */
export const NewVersionDialog = ({
  running,
  appName,
  fetchServed = fetchServedVersion,
  reload = (): void => window.location.reload(),
  intervalMs = 10 * MINUTE,
  image,
  imageBackground
}: NewVersionDialogProps): React.ReactElement => {
  const { t, lang } = useI18n()
  useExtendI18n({ [lang]: locales[lang] ?? locales.en })
  const titleId = useId()
  const [offered, setOffered] = useState<ServedVersion | null>(null)
  // Read only in events, never drawn: a ref, not state
  const declined = useRef(new Set<string>())

  useVersionChecks(async () => {
    if (offered !== null) return
    const answer = await fetchServed().catch(() => null)
    const served =
      typeof answer === 'string' ? { build: answer, notes: null } : answer
    if (
      served !== null &&
      isNewBuild(running, served.build) &&
      !declined.current.has(served.build)
    ) {
      setOffered(served)
    }
  }, intervalMs)

  const notes = notesFor(offered?.notes ?? null, lang)

  const notNow = (): void => {
    if (offered !== null) declined.current.add(offered.build)
    setOffered(null)
  }

  return (
    <Dialog
      open={offered !== null}
      onClose={notNow}
      size="small"
      aria-labelledby={titleId}
      data-testid="new-version-dialog"
    >
      {image !== undefined && (
        <Banner image={image} background={imageBackground} />
      )}
      <DialogTitle id={titleId} sx={{ textAlign: 'center' }}>
        {/* The typings of twake-i18n's `t` take no interpolation options */}
        {t('twakeNewVersion.title').replace('%{appName}', appName)}
      </DialogTitle>
      {/* The theme leaves 32 px (28 below md) more above the content than
          under it. The top padding, set by the theme on a content that follows
          a title (hence the same selector), gives up 16 px and the bottom
          takes 12 (8 below md): the text sits midway between the title and
          the buttons, list margins or not, in a dialog no taller than before.
          With notes, PatchNotes is the only scrolling zone */}
      <DialogContent
        sx={{
          [`.${dialogTitleClasses.root} + &`]: { pt: 1 },
          pb: { xs: 1, md: 1.5 },
          ...(notes !== null && { overflowY: 'visible' })
        }}
      >
        {notes !== null ? (
          <PatchNotes notes={notes} titleId={titleId} />
        ) : (
          <DialogContentText sx={{ textAlign: 'center' }}>
            {t('twakeNewVersion.body').replace('%{appName}', appName)}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button
          variant="text"
          data-testid="new-version-not-now"
          onClick={notNow}
        >
          {t('twakeNewVersion.notNow')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          data-testid="new-version-reload"
          onClick={reload}
        >
          {t('twakeNewVersion.reload')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
