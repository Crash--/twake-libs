import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { UserMenu } from './UserMenu.js'
import {
  INSTANCE,
  makeApp,
  makeSdk,
  renderWithSdk,
  useMobileViewport
} from './testUtils.js'

const openMenu = async (): Promise<HTMLElement> => {
  const user = userEvent.setup()
  const button = screen.getByTestId('twake-bar-user-button')
  // Disabled until the instance is loaded
  await waitFor(() => expect(button).toBeEnabled())
  await user.click(button)
  return screen.findByTestId('twake-bar-user-menu')
}

describe('UserMenu', () => {
  it('shows the user, the storage left and the settings links', async () => {
    const sdk = makeSdk({ apps: [makeApp({ slug: 'settings' })] })
    renderWithSdk(<UserMenu onLogOut={vi.fn()} />, sdk)

    await openMenu()

    expect(screen.queryByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('alice@example.com')).toBeInTheDocument()
    expect(screen.queryByText('75 GB available')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /Manage profile/ })
    ).toHaveAttribute('href', 'https://alice-settings.twake.example/#/profile')
    expect(screen.getByRole('menuitem', { name: /Storage/ })).toHaveAttribute(
      'href',
      'https://alice-settings.twake.example/#/storage'
    )
  })

  it('hides the settings links when the settings app is not installed', async () => {
    renderWithSdk(<UserMenu onLogOut={vi.fn()} />, makeSdk())

    await openMenu()

    expect(screen.queryByText('Manage profile')).toBe(null)
    expect(screen.queryByText('Storage')).toBe(null)
    expect(screen.queryByTestId('twake-bar-logout')).toBeInTheDocument()
  })

  it('warns that the email is not active for an organization without a mail app', async () => {
    const sdk = makeSdk({ instance: { ...INSTANCE, org_id: 'acme' } })
    renderWithSdk(<UserMenu onLogOut={vi.fn()} />, sdk)

    await openMenu()

    expect(screen.queryByText('Email not active')).toBeInTheDocument()
  })

  it('does not warn once a mail app is installed', async () => {
    const sdk = makeSdk({
      instance: { ...INSTANCE, org_id: 'acme' },
      apps: [makeApp({ slug: 'mail' })]
    })
    renderWithSdk(<UserMenu onLogOut={vi.fn()} />, sdk)

    await openMenu()

    expect(screen.queryByText('Email not active')).toBe(null)
  })

  it('keeps the log out when the platform refuses its data', async () => {
    const sdk = makeSdk()
    sdk.getInstance = vi.fn(() => Promise.reject(new Error('403')))
    sdk.getApps = vi.fn(() => Promise.reject(new Error('403')))
    const onLogOut = vi.fn()
    renderWithSdk(<UserMenu onLogOut={onLogOut} />, sdk)

    await openMenu()

    expect(screen.queryByText('Storage')).toBe(null)
    expect(screen.queryByText('Email not active')).toBe(null)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('twake-bar-logout'))
    expect(onLogOut).toHaveBeenCalledTimes(1)
  })

  describe('on mobile', () => {
    useMobileViewport()

    it('opens as a dialog with the same entries', async () => {
      const sdk = makeSdk({ apps: [makeApp({ slug: 'settings' })] })
      renderWithSdk(<UserMenu onLogOut={vi.fn()} />, sdk)

      await openMenu()

      expect(screen.queryByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('Manage profile')).toBeInTheDocument()
      expect(screen.queryByTestId('twake-bar-logout')).toBeInTheDocument()
    })
  })
})
