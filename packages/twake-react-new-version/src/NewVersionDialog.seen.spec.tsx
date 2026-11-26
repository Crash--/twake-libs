import { act, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

import { NewVersionDialog } from './NewVersionDialog.js'
import { notesFingerprint } from './seenNotes.js'
import { requestVersionCheck, type ServedVersion } from './version.js'

const NOTES = { en: '- Dark mode', fr: '- Mode sombre' }
const KEY = 'twake-new-version:mail'

const renderDialog = ({
  served,
  lang = 'en',
  seenNotesKey = 'mail',
  reload = vi.fn()
}: {
  served: ServedVersion | string | null
  lang?: string
  seenNotesKey?: string | null
  reload?: () => void
}): { fetchServed: ReturnType<typeof vi.fn>; unmount: () => void } => {
  const fetchServed = vi.fn(() => Promise.resolve(served))
  const { unmount } = render(
    <TwakeMuiThemeProvider>
      <I18n lang={lang} dictRequire={(): Record<string, unknown> => ({})}>
        <NewVersionDialog
          running="b1"
          appName="Twake Mail"
          fetchServed={fetchServed}
          reload={reload}
          seenNotesKey={seenNotesKey ?? undefined}
        />
      </I18n>
    </TwakeMuiThemeProvider>
  )
  return { fetchServed, unmount }
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

afterEach(() => window.localStorage.clear())

describe('NewVersionDialog notes at load', () => {
  it('shows the notes of the running build not seen yet, with « Got it » alone', async () => {
    renderDialog({ served: { build: 'b1', notes: NOTES } })

    expect(await screen.findByRole('dialog')).toHaveTextContent('Dark mode')
    expect(screen.getByTestId('new-version-got-it')).toHaveTextContent('Got it')
    expect(screen.queryByTestId('new-version-reload')).toBe(null)
    expect(screen.queryByTestId('new-version-not-now')).toBe(null)
  })

  it('reads « Compris » in French', async () => {
    renderDialog({ served: { build: 'b1', notes: NOTES }, lang: 'fr' })

    expect(await screen.findByTestId('new-version-got-it')).toHaveTextContent(
      'Compris'
    )
  })

  it('remembers them once acknowledged, so the next load shows nothing', async () => {
    const first = renderDialog({ served: { build: 'b1', notes: NOTES } })
    await userEvent.click(await screen.findByTestId('new-version-got-it'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))
    expect(window.localStorage.getItem(KEY)).toBe(notesFingerprint(NOTES))
    first.unmount()

    const { fetchServed } = renderDialog({
      served: { build: 'b1', notes: NOTES }
    })
    await settle()

    expect(fetchServed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('remembers them on Escape too', async () => {
    renderDialog({ served: { build: 'b1', notes: NOTES } })
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))
    expect(window.localStorage.getItem(KEY)).toBe(notesFingerprint(NOTES))
  })

  it('does not show them again in another language', async () => {
    window.localStorage.setItem(KEY, notesFingerprint(NOTES))
    renderDialog({ served: { build: 'b1', notes: NOTES }, lang: 'fr' })
    await settle()

    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('does not show them again with other line endings or a trailing space', async () => {
    window.localStorage.setItem(KEY, notesFingerprint(NOTES))
    renderDialog({
      served: {
        build: 'b2',
        notes: { en: `${NOTES.en} \r\n`, fr: `${NOTES.fr}\r\n` }
      }
    })
    renderDialog({
      served: { build: 'b1', notes: { en: `${NOTES.en} `, fr: NOTES.fr } }
    })
    await settle()

    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('shows them again once they change', async () => {
    window.localStorage.setItem(KEY, notesFingerprint(NOTES))
    renderDialog({
      served: { build: 'b2', notes: { ...NOTES, en: '- Search' } }
    })
    await settle()
    expect(screen.queryByRole('dialog')).toBe(null)

    renderDialog({ served: { build: 'b1', notes: { en: '- Search' } } })
    expect(await screen.findByRole('dialog')).toHaveTextContent('Search')
  })

  it('shows nothing for a build without notes, or another build than the running one', async () => {
    renderDialog({ served: 'b1' })
    renderDialog({ served: { build: 'b1', notes: null } })
    renderDialog({ served: { build: 'b2', notes: NOTES } })
    await settle()

    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('shows nothing without notes in the language of the app or in English', async () => {
    renderDialog({ served: { build: 'b1', notes: { fr: '- A' } }, lang: 'de' })
    await settle()

    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('asks nothing at load without seenNotesKey', async () => {
    const { fetchServed } = renderDialog({
      served: { build: 'b1', notes: NOTES },
      seenNotesKey: null
    })
    await settle()

    expect(fetchServed).not.toHaveBeenCalled()
  })

  it('counts the notes of the update dialog as seen on « Reload »', async () => {
    const reload = vi.fn()
    renderDialog({ served: { build: 'b2', notes: NOTES }, reload })
    await settle()
    await act(async () => {
      requestVersionCheck()
      await Promise.resolve()
    })

    await userEvent.click(await screen.findByTestId('new-version-reload'))

    expect(reload).toHaveBeenCalled()
    expect(window.localStorage.getItem(KEY)).toBe(notesFingerprint(NOTES))
  })

  it('drops the notes at load that arrive after a newer build is offered', async () => {
    let answerAtLoad: (served: ServedVersion) => void = () => undefined
    const fetchServed = vi
      .fn<() => Promise<ServedVersion>>()
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            answerAtLoad = resolve
          })
      )
      .mockResolvedValue({ build: 'b2', notes: null })
    render(
      <TwakeMuiThemeProvider>
        <I18n lang="en" dictRequire={(): Record<string, unknown> => ({})}>
          <NewVersionDialog
            running="b1"
            appName="Twake Mail"
            fetchServed={fetchServed}
            reload={vi.fn()}
            seenNotesKey="mail"
          />
        </I18n>
      </TwakeMuiThemeProvider>
    )
    await act(async () => {
      requestVersionCheck()
      await Promise.resolve()
    })
    await screen.findByTestId('new-version-reload')

    await act(async () => {
      answerAtLoad({ build: 'b1', notes: NOTES })
      await Promise.resolve()
    })
    await userEvent.click(screen.getByTestId('new-version-not-now'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))
    expect(window.localStorage.getItem(KEY)).toBe(null)
  })

  it('gives way to the update dialog once a newer build is served', async () => {
    let served: ServedVersion = { build: 'b1', notes: NOTES }
    const fetchServed = vi.fn(() => Promise.resolve(served))
    render(
      <TwakeMuiThemeProvider>
        <I18n lang="en" dictRequire={(): Record<string, unknown> => ({})}>
          <NewVersionDialog
            running="b1"
            appName="Twake Mail"
            fetchServed={fetchServed}
            reload={vi.fn()}
            seenNotesKey="mail"
          />
        </I18n>
      </TwakeMuiThemeProvider>
    )
    await screen.findByTestId('new-version-got-it')

    served = { build: 'b2', notes: { en: '- Search' } }
    await act(async () => {
      requestVersionCheck()
      await Promise.resolve()
    })

    expect(await screen.findByTestId('new-version-reload')).toBeVisible()
    expect(screen.getByRole('dialog')).toHaveTextContent('Search')
    await userEvent.click(screen.getByTestId('new-version-not-now'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))
  })

  it('counts them as seen on « Not now »', async () => {
    renderDialog({ served: { build: 'b2', notes: NOTES } })
    await settle()
    await act(async () => {
      requestVersionCheck()
      await Promise.resolve()
    })

    await userEvent.click(await screen.findByTestId('new-version-not-now'))

    expect(window.localStorage.getItem(KEY)).toBe(notesFingerprint(NOTES))
  })
})
