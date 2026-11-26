import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

import { NewVersionDialog } from './NewVersionDialog.js'
import { requestVersionCheck, type ServedVersion } from './version.js'

const URL = 'https://chat.example.com/#/room/release-notes'

const open = async ({
  served,
  notesUrl,
  lang = 'en'
}: {
  served: ServedVersion | string
  notesUrl?: string
  lang?: string
}): Promise<void> => {
  render(
    <TwakeMuiThemeProvider>
      <I18n lang={lang} dictRequire={(): Record<string, unknown> => ({})}>
        <NewVersionDialog
          running="b1"
          appName="Twake Mail"
          fetchServed={(): Promise<ServedVersion | string> =>
            Promise.resolve(served)
          }
          reload={vi.fn()}
          notesUrl={notesUrl}
        />
      </I18n>
    </TwakeMuiThemeProvider>
  )
  await act(async () => {
    requestVersionCheck()
    await Promise.resolve()
  })
  await screen.findByRole('dialog')
}

describe('NewVersionDialog notes link', () => {
  it('links to every change under the notes, in a new tab', async () => {
    await open({
      served: { build: 'b2', notes: { en: '- Dark mode' } },
      notesUrl: URL
    })

    const link = screen.getByRole('link', { name: "See everything that's new" })
    expect(link).toHaveAttribute('href', URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('reads « Voir toutes les nouveautés » in French', async () => {
    await open({
      served: { build: 'b2', notes: { fr: '- Mode sombre' } },
      notesUrl: URL,
      lang: 'fr'
    })

    expect(
      screen.getByRole('link', { name: 'Voir toutes les nouveautés' })
    ).toBeInTheDocument()
  })

  it('links to every change from the notes shown at load too, above « Compris »', async () => {
    render(
      <TwakeMuiThemeProvider>
        <I18n lang="fr" dictRequire={(): Record<string, unknown> => ({})}>
          <NewVersionDialog
            running="b1"
            appName="Twake Mail"
            fetchServed={(): Promise<ServedVersion> =>
              Promise.resolve({ build: 'b1', notes: { fr: '- Mode sombre' } })
            }
            reload={vi.fn()}
            seenNotesKey="mail-link"
            notesUrl={URL}
          />
        </I18n>
      </TwakeMuiThemeProvider>
    )

    expect(
      await screen.findByRole('link', { name: 'Voir toutes les nouveautés' })
    ).toHaveAttribute('href', URL)
    expect(screen.getByTestId('new-version-got-it')).toHaveTextContent(
      'Compris'
    )
    window.localStorage.clear()
  })

  it('has no link without notesUrl', async () => {
    await open({ served: { build: 'b2', notes: { en: '- Dark mode' } } })

    expect(screen.queryByTestId('new-version-notes-link')).toBe(null)
  })

  it('has no link without notes', async () => {
    await open({ served: 'b2', notesUrl: URL })

    expect(screen.queryByTestId('new-version-notes-link')).toBe(null)
  })
})
