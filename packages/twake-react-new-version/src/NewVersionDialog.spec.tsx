import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

import { NewVersionDialog } from './NewVersionDialog'
import { requestVersionCheck } from './version'

const renderDialog = ({
  served = 'b2',
  lang = 'en',
  intervalMs,
  image,
  imageBackground
}: {
  served?: string | null
  lang?: string
  intervalMs?: number
  image?: string
  imageBackground?: string
} = {}): {
  fetchServed: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
} => {
  const fetchServed = vi.fn(() => Promise.resolve(served))
  const reload = vi.fn()
  render(
    <TwakeMuiThemeProvider>
      <I18n lang={lang} dictRequire={(): Record<string, unknown> => ({})}>
        <NewVersionDialog
          running="b1"
          appName="Twake Mail"
          fetchServed={fetchServed}
          reload={reload}
          intervalMs={intervalMs}
          image={image}
          imageBackground={imageBackground}
        />
      </I18n>
    </TwakeMuiThemeProvider>
  )
  return { fetchServed, reload }
}

const check = async (): Promise<void> => {
  await act(async () => {
    requestVersionCheck()
    await Promise.resolve()
  })
}

const dialog = (): HTMLElement | null =>
  screen.queryByRole('dialog', { name: "What's new in Twake Mail" })

afterEach(() => {
  vi.useRealTimers()
})

describe('NewVersionDialog', () => {
  it('does not ask at mount: the page just loaded is the served build', () => {
    const { fetchServed } = renderDialog()

    expect(fetchServed).not.toHaveBeenCalled()
    expect(dialog()).toBe(null)
  })

  it('offers a reload once another build is served, naming the app', async () => {
    const { reload } = renderDialog()

    await check()

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'An update just arrived. Reload to get it.'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the same build', 'b1'],
    ['no answer', null]
  ])('stays closed for %s', async (_, served) => {
    renderDialog({ served })

    await check()

    expect(dialog()).toBe(null)
  })

  it('stays closed when the check fails', async () => {
    const { fetchServed } = renderDialog()
    fetchServed.mockRejectedValue(new Error('offline'))

    await check()

    expect(fetchServed).toHaveBeenCalled()
    expect(dialog()).toBe(null)
  })

  it('« Not now » declines that build: it is not offered again', async () => {
    const { fetchServed } = renderDialog()
    await check()
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(dialog()).toBe(null))
    await check()

    expect(fetchServed).toHaveBeenCalledTimes(2)
    expect(dialog()).toBe(null)
  })

  it('offers the next build after one was declined', async () => {
    const { fetchServed } = renderDialog()
    await check()
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(dialog()).toBe(null))

    fetchServed.mockResolvedValue('b3')
    await check()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('never offers again a build declined before, after another one', async () => {
    const { fetchServed } = renderDialog()
    const decline = async (): Promise<void> => {
      await check()
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
      await waitFor(() => expect(dialog()).toBe(null))
    }
    await decline()
    fetchServed.mockResolvedValue('b3')
    await decline()

    fetchServed.mockResolvedValue('b2')
    await check()

    expect(dialog()).toBe(null)
  })

  it('Escape declines the build like « Not now »', async () => {
    renderDialog()
    await check()
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog()).toBe(null))
    await check()

    expect(dialog()).toBe(null)
  })

  it('checks on its own every interval', async () => {
    vi.useFakeTimers()
    const { fetchServed } = renderDialog({ intervalMs: 1000 })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(fetchServed).toHaveBeenCalledTimes(1)
  })

  it.each(['focus', 'online'])('checks on %s', name => {
    const { fetchServed } = renderDialog()

    act(() => {
      window.dispatchEvent(new Event(name))
    })

    expect(fetchServed).toHaveBeenCalledTimes(1)
  })

  it('checks at most once per 30 seconds on focus', async () => {
    vi.useFakeTimers()
    const { fetchServed } = renderDialog({ served: 'b1' })
    const focus = async (): Promise<void> => {
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(0)
      })
    }

    await focus()
    await focus()
    expect(fetchServed).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await focus()
    expect(fetchServed).toHaveBeenCalledTimes(2)
  })

  it('runs one check at a time, even when the app asks', () => {
    const { fetchServed } = renderDialog()
    fetchServed.mockReturnValue(new Promise(() => undefined))

    act(() => {
      requestVersionCheck()
      requestVersionCheck()
    })

    expect(fetchServed).toHaveBeenCalledTimes(1)
  })

  it('keeps one check at a time when the interval changes', () => {
    const fetchServed = vi.fn(() => new Promise<string | null>(() => undefined))
    const dialog = (intervalMs: number): React.ReactElement => (
      <TwakeMuiThemeProvider>
        <I18n lang="en" dictRequire={(): Record<string, unknown> => ({})}>
          <NewVersionDialog
            running="b1"
            appName="Twake Mail"
            fetchServed={fetchServed}
            intervalMs={intervalMs}
          />
        </I18n>
      </TwakeMuiThemeProvider>
    )
    const { rerender } = render(dialog(60_000))
    act(() => {
      requestVersionCheck()
    })

    rerender(dialog(120_000))
    act(() => {
      requestVersionCheck()
    })

    expect(fetchServed).toHaveBeenCalledTimes(1)
  })

  it('checks at once when the app asks, whatever the last check', async () => {
    const { fetchServed } = renderDialog({ served: 'b1' })

    await check()
    await check()

    expect(fetchServed).toHaveBeenCalledTimes(2)
  })

  it('checks when the tab becomes visible again', () => {
    const { fetchServed } = renderDialog()

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(fetchServed).toHaveBeenCalledTimes(1)
  })

  it('speaks the language of the app', async () => {
    renderDialog({ lang: 'fr' })

    await check()

    const fr = await screen.findByRole('dialog')
    expect(fr).toHaveAccessibleName(expect.stringContaining('Twake Mail'))
    expect(fr).not.toHaveTextContent('%{appName}')
    expect(fr).not.toHaveTextContent('An update just arrived')
    expect(
      screen.getByRole('button', { name: 'Pas maintenant' })
    ).toBeInTheDocument()
  })

  it('falls back to English for a language it does not have', async () => {
    renderDialog({ lang: 'pt' })

    await check()

    expect(
      await screen.findByRole('dialog', { name: "What's new in Twake Mail" })
    ).toBeInTheDocument()
  })
})

describe('NewVersionDialog look', () => {
  const open = async (
    options: Parameters<typeof renderDialog>[0] = {}
  ): Promise<HTMLElement> => {
    renderDialog(options)
    await check()
    return screen.findByRole('dialog')
  }
  const banner = (d: HTMLElement): HTMLElement | null =>
    d.querySelector('img')?.parentElement ?? null

  it('names the dialog after its title, with the app name', async () => {
    const d = await open()

    expect(d).toHaveAccessibleName("What's new in Twake Mail")
    expect(d).toHaveTextContent('An update just arrived. Reload to get it.')
    expect(d).not.toHaveTextContent('%{appName}')
  })

  it('shows a decorative illustration in a banner when given an image', async () => {
    const d = await open({
      image: '/mail.png',
      imageBackground: 'rgb(1, 2, 3)'
    })

    const img = d.querySelector('img')
    expect(img).toHaveAttribute('src', '/mail.png')
    expect(img).toHaveAttribute('alt', '')
    expect(within(d).queryByRole('img')).toBe(null)
    expect(banner(d)).toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' })
  })

  it('has a banner with a default background when no colour is given', async () => {
    const d = await open({ image: '/mail.png' })

    const color = getComputedStyle(banner(d) as HTMLElement).backgroundColor
    expect(color).not.toBe('')
    expect(color).not.toBe('transparent')
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('has no banner and no image without an image', async () => {
    const d = await open({ imageBackground: 'rgb(1, 2, 3)' })

    expect(d.querySelector('img')).toBe(null)
  })

  it('centres the title and the body', async () => {
    await open()

    expect(screen.getByText("What's new in Twake Mail")).toHaveStyle({
      textAlign: 'center'
    })
    expect(
      screen.getByText('An update just arrived. Reload to get it.')
    ).toHaveStyle({ textAlign: 'center' })
  })

  it('centres the buttons, « Not now » before « Reload »', async () => {
    const d = await open()

    const notNow = screen.getByTestId('new-version-not-now')
    const reloadButton = screen.getByTestId('new-version-reload')
    expect(notNow.parentElement).toBe(reloadButton.parentElement)
    expect(notNow.parentElement).toHaveStyle({ justifyContent: 'center' })
    expect(
      notNow.compareDocumentPosition(reloadButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(d).toContainElement(notNow)
  })
})
