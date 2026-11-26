import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TwakeBar } from './TwakeBar'
import { INSTANCE, makeApp, makeSdk, renderWithSdk } from './testUtils'

const APP = { slug: 'calendar', name: 'Calendar', icon: 'https://cal/icon.svg' }

const renderBar = (
  sdk = makeSdk(),
  props: Partial<React.ComponentProps<typeof TwakeBar>> = {}
): ReturnType<typeof renderWithSdk> =>
  renderWithSdk(<TwakeBar app={APP} onLogOut={vi.fn()} {...props} />, sdk)

describe('TwakeBar', () => {
  it('shows an avatar skeleton and no menu while waiting for credentials', () => {
    renderBar(makeSdk({ status: 'waiting' }))

    expect(
      screen.queryByTestId('twake-bar-avatar-skeleton')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
    expect(screen.queryByTestId('twake-bar-apps-button')).toBe(null)
  })

  it('shows logged out, without the home, on a public page', () => {
    renderBar(makeSdk({ status: 'public' }))

    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
    expect(screen.queryByTestId('twake-bar-home')).toBe(null)
    expect(screen.queryByRole('img', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('shows the home logo, not a link, until the platform gives its URL', () => {
    renderBar(makeSdk({ status: 'waiting' }))

    const home = screen.getByTestId('twake-bar-home')
    expect(home.tagName).toBe('SPAN')
    expect(home).not.toHaveAttribute('aria-label')
    expect(screen.queryByRole('link', { name: 'Home' })).toBe(null)
  })

  it('shows the menus once the client is ready', async () => {
    const sdk = makeSdk({
      status: 'waiting',
      apps: [makeApp({ slug: 'home' })],
      context: { help_link: 'https://help.example' }
    })
    renderBar(sdk)

    act(() => sdk.setStatus('ready'))

    expect(screen.queryByTestId('twake-bar-apps-button')).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    expect(await screen.findByRole('link', { name: 'Help' })).toHaveAttribute(
      'href',
      'https://help.example'
    )
    await waitFor(() =>
      expect(screen.getByTestId('twake-bar-home')).toHaveAttribute(
        'href',
        'https://alice-home.twake.example/'
      )
    )
  })

  it('lets the host replace the left side', () => {
    renderBar(makeSdk(), { slots: { left: <span>Custom left</span> } })

    expect(screen.queryByText('Custom left')).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-home')).toBe(null)
  })

  it('hands the logout to the host', async () => {
    const onLogOut = vi.fn()
    const user = userEvent.setup()
    renderBar(makeSdk({ instance: INSTANCE }), { onLogOut })

    const button = screen.getByTestId('twake-bar-user-button')
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await user.click(await screen.findByTestId('twake-bar-logout'))

    expect(onLogOut).toHaveBeenCalledTimes(1)
  })

  describe('help of the host', () => {
    const SUPPORT = {
      label: 'Get help or report a bug',
      href: 'https://support.example/mail'
    }

    it('puts the help of the platform and the host behind one "?"', async () => {
      const user = userEvent.setup()
      renderBar(makeSdk({ context: { help_link: 'https://help.example' } }), {
        helpItems: [SUPPORT]
      })

      const help = await screen.findByRole('button', { name: 'Help' })
      expect(screen.queryAllByRole('link', { name: /help/i })).toHaveLength(0)
      await user.click(help)

      expect(
        await screen.findByRole('menuitem', { name: 'Help center' })
      ).toHaveAttribute('href', 'https://help.example')
      expect(
        screen.getByRole('menuitem', { name: 'Get help or report a bug' })
      ).toHaveAttribute('href', 'https://support.example/mail')
    })

    it('runs the action of an entry and closes the menu', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      renderBar(makeSdk({ context: { help_link: 'https://help.example' } }), {
        helpItems: [{ label: 'Write to the support', onClick }]
      })

      await user.click(await screen.findByRole('button', { name: 'Help' }))
      await user.click(
        await screen.findByRole('menuitem', { name: 'Write to the support' })
      )

      expect(onClick).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('menu')).toBe(null))
    })

    it('opens the only entry of the host at once', async () => {
      renderBar(makeSdk({ context: {} }), { helpItems: [SUPPORT] })

      expect(
        await screen.findByRole('link', { name: 'Get help or report a bug' })
      ).toHaveAttribute('href', 'https://support.example/mail')
      expect(screen.queryByRole('button', { name: 'Help' })).toBe(null)
    })

    it.each(['mailto:support@example.com', '  mailto:support@example.com'])(
      'opens %j alone in the same tab',
      async href => {
        renderBar(makeSdk({ context: {} }), {
          helpItems: [{ label: 'Write to the support', href }]
        })

        const single = await screen.findByRole('link', {
          name: 'Write to the support'
        })
        expect(single).toHaveAttribute('href', href)
        expect(single).not.toHaveAttribute('target')
      }
    )

    it('opens the entries that are not web pages in the same tab', async () => {
      const user = userEvent.setup()
      renderBar(makeSdk({ context: { help_link: 'https://help.example' } }), {
        helpItems: [
          { label: 'Write to the support', href: 'mailto:support@example.com' },
          { label: 'Call the support', href: 'tel:+33100000000' },
          { label: 'Write again', href: ' MAILTO:support@example.com' },
          SUPPORT
        ]
      })

      await user.click(await screen.findByRole('button', { name: 'Help' }))
      for (const name of [
        'Write to the support',
        'Call the support',
        'Write again'
      ]) {
        expect(
          await screen.findByRole('menuitem', { name })
        ).not.toHaveAttribute('target')
      }
      expect(
        screen.getByRole('menuitem', { name: 'Get help or report a bug' })
      ).toHaveAttribute('target', '_blank')
      expect(
        screen.getByRole('menuitem', { name: 'Help center' })
      ).toHaveAttribute('target', '_blank')
    })

    it('takes an empty help link for none', async () => {
      renderBar(makeSdk({ context: { help_link: '' } }), {
        helpItems: [SUPPORT]
      })

      expect(
        await screen.findByRole('link', { name: 'Get help or report a bug' })
      ).toHaveAttribute('href', 'https://support.example/mail')
      expect(screen.queryByRole('button', { name: 'Help' })).toBe(null)
    })

    it('waits for the context before showing the help of the host', async () => {
      let answer: (context: Record<string, unknown>) => void = () => undefined
      const sdk = makeSdk()
      const getContext = vi.spyOn(sdk, 'getContext').mockReturnValueOnce(
        new Promise(resolve => {
          answer = resolve
        })
      )
      renderBar(sdk, { helpItems: [SUPPORT] })

      await waitFor(() => expect(getContext).toHaveBeenCalled())
      expect(
        screen.queryByRole('link', { name: 'Get help or report a bug' })
      ).toBe(null)
      act(() => answer({ help_link: 'https://help.example' }))

      expect(
        await screen.findByRole('button', { name: 'Help' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Get help or report a bug' })
      ).toBe(null)
    })

    it('groups the help of the fallback and the host off the platform', () => {
      renderWithSdk(
        <TwakeBar
          app={APP}
          onLogOut={vi.fn()}
          fallback={{ helpLink: 'https://support.example' }}
          helpItems={[SUPPORT]}
        />
      )

      expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Help' })).toBe(null)
    })
  })

  describe('off the platform', () => {
    const FALLBACK = {
      helpLink: 'https://support.example',
      apps: [
        {
          name: 'Mail',
          href: 'https://mail.example/',
          icon: 'https://mail.example/icon.svg'
        }
      ],
      user: { name: 'Alice Martin', email: 'alice@example.com' }
    }

    it('shows the fallbacks without a client', async () => {
      const onLogOut = vi.fn()
      const user = userEvent.setup()
      renderWithSdk(
        <TwakeBar app={APP} onLogOut={onLogOut} fallback={FALLBACK} />
      )

      expect(screen.queryByTestId('twake-bar-home')).toBe(null)
      expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute(
        'href',
        'https://support.example'
      )

      await user.click(screen.getByTestId('twake-bar-apps-button'))
      expect(await screen.findByTitle('Mail')).toHaveAttribute(
        'href',
        'https://mail.example/'
      )
      await user.keyboard('{Escape}')

      await user.click(screen.getByTestId('twake-bar-user-button'))
      expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
      await user.click(screen.getByTestId('twake-bar-logout'))
      expect(onLogOut).toHaveBeenCalledTimes(1)
    })

    it('shows no help for an empty help link of the fallback', () => {
      renderWithSdk(
        <TwakeBar app={APP} onLogOut={vi.fn()} fallback={{ helpLink: '' }} />
      )

      expect(screen.queryByRole('link', { name: 'Help' })).toBe(null)
      expect(screen.queryByRole('button', { name: 'Help' })).toBe(null)
    })

    it('keeps the log out without a user', async () => {
      const user = userEvent.setup()
      renderWithSdk(<TwakeBar app={APP} onLogOut={vi.fn()} fallback={{}} />)

      expect(screen.queryByTestId('twake-bar-apps-button')).toBe(null)
      expect(screen.queryByRole('link', { name: 'Help' })).toBe(null)
      await user.click(screen.getByTestId('twake-bar-user-button'))
      expect(await screen.findByTestId('twake-bar-logout')).toBeInTheDocument()
    })

    it('shows the account menu of the host in place of its own', () => {
      renderWithSdk(
        <TwakeBar
          app={APP}
          onLogOut={vi.fn()}
          fallback={{
            ...FALLBACK,
            userMenu: <button type="button">Account of Alice</button>
          }}
        />
      )

      expect(screen.getByTestId('twake-bar-apps-button')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Account of Alice' }).parentElement
      ).toBe(screen.getAllByRole('navigation').at(-1))
      expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
    })

    it('shows no account menu when the host gives false', () => {
      renderWithSdk(
        <TwakeBar
          app={APP}
          onLogOut={vi.fn()}
          fallback={{ ...FALLBACK, userMenu: false }}
        />
      )

      expect(screen.getByTestId('twake-bar-apps-button')).toBeInTheDocument()
      expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
      expect(screen.getAllByRole('navigation')).toHaveLength(1)
    })

    it('replaces the fallbacks by the platform once ready', async () => {
      renderBar(makeSdk({ context: { help_link: 'https://help.example' } }), {
        fallback: FALLBACK
      })

      expect(await screen.findByRole('link', { name: 'Help' })).toHaveAttribute(
        'href',
        'https://help.example'
      )
    })
  })
})
