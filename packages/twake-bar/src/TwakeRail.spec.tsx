import { screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TwakeRail } from './TwakeRail'
import { makeApp, makeSdk, renderWithSdk } from './testUtils'

const PLATFORM_APPS = [
  makeApp({ slug: 'mail', name: 'Mail' }),
  makeApp({ slug: 'notes', name: 'Notes' }),
  makeApp({ slug: 'drive', name: 'Drive' }),
  makeApp({ slug: 'calendar', name: 'Calendar' })
]

const renderRail = (
  props: Partial<React.ComponentProps<typeof TwakeRail>> = {},
  sdk = makeSdk({ apps: PLATFORM_APPS })
): ReturnType<typeof renderWithSdk> =>
  renderWithSdk(<TwakeRail current="mail" onLogOut={vi.fn()} {...props} />, sdk)

const speculationRules = (): unknown[] =>
  [...document.head.querySelectorAll('script[type="speculationrules"]')].map(
    script => JSON.parse(script.textContent ?? '') as unknown
  )

// jsdom has no HTMLScriptElement.supports: the browsers that do answer here
const supportSpeculationRules = (supported: boolean): void => {
  Object.defineProperty(HTMLScriptElement, 'supports', {
    configurable: true,
    value: (type: string) => supported && type === 'speculationrules'
  })
}

afterEach(() => {
  Reflect.deleteProperty(HTMLScriptElement, 'supports')
})

describe('TwakeRail', () => {
  it('lists the apps of the rail the platform has, in the rail order', async () => {
    renderRail()

    const links = await screen.findAllByRole('link')
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
      'Drive',
      'Mail',
      'Calendar'
    ])
  })

  it('opens an app in the same tab and marks the current one', async () => {
    renderRail({ current: 'calendar' })

    const calendar = await screen.findByRole('link', { name: 'Calendar' })
    expect(calendar).toHaveAttribute(
      'href',
      'https://alice-calendar.twake.example/'
    )
    expect(calendar).not.toHaveAttribute('target')
    expect(calendar).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mail' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('follows the order and the apps the host gives', async () => {
    renderRail({ apps: ['calendar', 'notes'] })

    const links = await screen.findAllByRole('link')
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
      'Calendar',
      'Notes'
    ])
  })

  it('leaves its placeholder when the platform cannot list its apps', async () => {
    const sdk = Object.assign(makeSdk(), {
      getApps: (): Promise<never> => Promise.reject(new Error('down'))
    })
    renderRail({}, sdk)

    await waitFor(() =>
      expect(screen.queryByTestId('twake-rail-loading')).toBe(null)
    )
    expect(screen.queryByRole('link')).toBe(null)
    expect(screen.getByTestId('twake-bar-apps-button')).toBeInTheDocument()
  })

  it('lists no app before the platform answers', () => {
    renderRail({}, makeSdk({ status: 'waiting', apps: PLATFORM_APPS }))

    expect(screen.queryByRole('link')).toBe(null)
  })

  it('prerenders on hover the other apps the host lists', async () => {
    supportSpeculationRules(true)
    const { unmount } = renderRail({ prerender: ['mail', 'drive', 'calendar'] })

    await waitFor(() =>
      expect(speculationRules()).toEqual([
        {
          prerender: [
            {
              urls: [
                'https://alice-drive.twake.example/',
                'https://alice-calendar.twake.example/'
              ],
              eagerness: 'moderate'
            }
          ]
        }
      ])
    )

    unmount()
    expect(speculationRules()).toEqual([])
  })

  it('prerenders no app the host does not list', async () => {
    supportSpeculationRules(true)
    renderRail()

    await screen.findAllByRole('link')
    expect(speculationRules()).toEqual([])
  })

  it('adds no rules where the browser has no Speculation Rules', async () => {
    supportSpeculationRules(false)
    renderRail({ prerender: ['drive'] })

    await screen.findAllByRole('link')
    expect(speculationRules()).toEqual([])
  })

  it('adds no rules where the browser cannot tell what it supports', async () => {
    renderRail({ prerender: ['drive'] })

    await screen.findAllByRole('link')
    expect(speculationRules()).toEqual([])
  })
})
