import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppsMenu } from './AppsMenu.js'
import { makeApp, makeSdk, renderWithSdk } from './testUtils.js'

const openMenu = async (): Promise<HTMLElement> => {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('twake-bar-apps-button'))
  return screen.findByTestId('twake-bar-apps')
}

describe('AppsMenu', () => {
  it('lists the apps but home, sorted by the flag, with their URL', async () => {
    const sdk = makeSdk({
      apps: [
        makeApp({ slug: 'home', name: 'Home' }),
        makeApp({ slug: 'drive', name: 'Drive', name_prefix: 'Twake' }),
        makeApp({ slug: 'mail', name: 'Mail' })
      ],
      flags: { 'apps.sort': ['mail', 'drive'] }
    })
    renderWithSdk(<AppsMenu />, sdk)

    const grid = await openMenu()

    const links = within(grid).getAllByRole('link')
    expect(links.map(link => link.getAttribute('title'))).toEqual([
      'Mail',
      'Drive'
    ])
    expect(links[1]).toHaveAttribute(
      'href',
      'https://alice-drive.twake.example/'
    )
  })

  it('adds the Home shortcuts and the entrypoints allowed by the flags', async () => {
    const sdk = makeSdk({
      apps: [
        makeApp({
          slug: 'contacts',
          name: 'Contacts',
          entrypoints: [
            {
              name: 'groups',
              title: { en: 'Groups' },
              hash: '/groups',
              icon: 'PHN2Zy8+'
            },
            {
              name: 'beta',
              title: { en: 'Beta' },
              hash: '/beta',
              conditions: [{ type: 'flag', name: 'contacts.beta', value: true }]
            }
          ]
        })
      ],
      shortcuts: [
        { id: 's1', name: 'Docs.url', url: 'https://docs.example', icon: null }
      ]
    })
    renderWithSdk(<AppsMenu />, sdk)

    const grid = await openMenu()

    const links = within(grid).getAllByRole('link')
    expect(links.map(link => link.getAttribute('title'))).toEqual([
      'Contacts',
      'Docs',
      'Groups'
    ])
    expect(links[1]).toHaveAttribute('href', 'https://docs.example')
    expect(links[2]).toHaveAttribute(
      'href',
      'https://alice-contacts.twake.example/#/groups'
    )
  })

  it('says so when the applications cannot be read', async () => {
    const sdk = makeSdk()
    sdk.getApps = vi.fn(() => Promise.reject(new Error('403')))
    renderWithSdk(<AppsMenu />, sdk)
    const user = userEvent.setup()

    await user.click(screen.getByTestId('twake-bar-apps-button'))

    expect(
      await screen.findByText('No applications found.')
    ).toBeInTheDocument()
  })

  it('says when there is no application', async () => {
    renderWithSdk(<AppsMenu />, makeSdk({ apps: [] }))
    const user = userEvent.setup()

    await user.click(screen.getByTestId('twake-bar-apps-button'))

    expect(
      await screen.findByText('No applications found.')
    ).toBeInTheDocument()
  })
})
