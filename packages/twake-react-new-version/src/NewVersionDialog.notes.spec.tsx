import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

import { NewVersionDialog } from './NewVersionDialog'
import { requestVersionCheck } from './version'

type Served = string | { build: string; notes: Record<string, string> | null }

const BODY = 'An update just arrived. Reload to get it.'

const renderDialog = (
  served: Served | null,
  lang = 'en'
): { fetchServed: ReturnType<typeof vi.fn> } => {
  const fetchServed = vi.fn(() => Promise.resolve(served))
  render(
    <TwakeMuiThemeProvider>
      <I18n lang={lang} dictRequire={(): Record<string, unknown> => ({})}>
        <NewVersionDialog
          running="b1"
          appName="Twake Mail"
          fetchServed={fetchServed}
          reload={vi.fn()}
        />
      </I18n>
    </TwakeMuiThemeProvider>
  )
  return { fetchServed }
}

const check = async (): Promise<void> => {
  await act(async () => {
    requestVersionCheck()
    await Promise.resolve()
  })
}

const open = async (
  served: Served | null,
  lang?: string
): Promise<{ fetchServed: ReturnType<typeof vi.fn>; d: HTMLElement }> => {
  const { fetchServed } = renderDialog(served, lang)
  await check()
  return { fetchServed, d: await screen.findByRole('dialog') }
}

describe('NewVersionDialog buttons', () => {
  it('« Not now » is a text button, « Reload » stays contained', async () => {
    await open('b2')

    const notNow = screen.getByTestId('new-version-not-now')
    expect(notNow).toHaveClass('MuiButton-text')
    expect(notNow).not.toHaveClass('MuiButton-outlined')
    expect(screen.getByTestId('new-version-reload')).toHaveClass(
      'MuiButton-contained'
    )
  })

  it('keeps both buttons centred', async () => {
    await open('b2')

    const notNow = screen.getByTestId('new-version-not-now')
    expect(notNow.parentElement).toBe(
      screen.getByTestId('new-version-reload').parentElement
    )
    expect(notNow.parentElement).toHaveStyle({ justifyContent: 'center' })
  })
})

describe('NewVersionDialog patch notes', () => {
  it('still accepts a bare build string, with the usual body', async () => {
    const { d } = await open('b2')

    expect(d).toHaveTextContent(BODY)
  })

  it('shows the notes of the app language instead of the body', async () => {
    const { d } = await open({
      build: 'b2',
      notes: { en: 'Faster search', fr: 'Recherche plus rapide' }
    })

    expect(d).toHaveTextContent('Faster search')
    expect(d).not.toHaveTextContent('Recherche plus rapide')
    expect(d).not.toHaveTextContent(BODY)
  })

  it('picks the language of the app', async () => {
    const { d } = await open(
      { build: 'b2', notes: { en: 'Faster search', fr: 'Recherche rapide' } },
      'fr'
    )

    expect(d).toHaveTextContent('Recherche rapide')
    expect(d).not.toHaveTextContent('Faster search')
  })

  it('falls back to the English notes', async () => {
    const { d } = await open(
      { build: 'b2', notes: { en: 'Faster search' } },
      'de'
    )

    expect(d).toHaveTextContent('Faster search')
  })

  it.each([
    ['null notes', null],
    ['notes with neither the language nor English', { fr: 'Rapide' }]
  ])('keeps the usual body for %s', async (_, notes) => {
    // 'pt' has no locale: the body falls back to English
    const { d } = await open({ build: 'b2', notes }, 'pt')

    expect(d).toHaveTextContent(BODY)
    expect(d).not.toHaveTextContent('Rapide')
  })

  it('draws consecutive "- " lines as a list and the other lines as text', async () => {
    const { d } = await open({
      build: 'b2',
      notes: { en: "What's new\n- Faster search\n- Dark mode\nThanks!" }
    })

    const list = within(d).getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual([
      'Faster search',
      'Dark mode'
    ])
    expect(d).toHaveTextContent("What's new")
    expect(d).toHaveTextContent('Thanks!')
    expect(list).not.toHaveTextContent("What's new")
    expect(list).not.toHaveTextContent('Thanks!')
  })

  it('makes two lists of two groups of "- " lines apart', async () => {
    const { d } = await open({
      build: 'b2',
      notes: { en: '- a\n- b\nmiddle\n- c' }
    })

    const lists = within(d).getAllByRole('list')
    expect(lists).toHaveLength(2)
    expect(within(lists[1]).getAllByRole('listitem')).toHaveLength(1)
  })

  it('has no list when the notes have no "- " line', async () => {
    const { d } = await open({ build: 'b2', notes: { en: 'Just a line' } })

    expect(within(d).queryByRole('list')).toBe(null)
    expect(d).toHaveTextContent('Just a line')
  })

  it('puts the notes in a scrollable zone with a maximum height', async () => {
    const { d } = await open({
      build: 'b2',
      notes: { en: '- one\n- two' }
    })

    let node: HTMLElement | null = within(d).getByRole('list')
    let found = false
    while (node && node !== d) {
      const style = getComputedStyle(node)
      if (
        style.overflowY === 'auto' &&
        style.maxHeight !== '' &&
        style.maxHeight !== 'none'
      ) {
        found = true
        break
      }
      node = node.parentElement
    }
    expect(found).toBe(true)
  })

  it('makes the notes a region named by the title, reachable by keyboard', async () => {
    const { d } = await open({ build: 'b2', notes: { en: '- one\n- two' } })

    const region = within(d).getByRole('region', {
      name: "What's new in Twake Mail"
    })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toContainElement(within(d).getByRole('list'))
    for (let i = 0; i < 4 && document.activeElement !== region; i++) {
      await userEvent.tab()
    }
    expect(region).toHaveFocus()
  })

  it('has one scroll zone for the notes: the region itself', async () => {
    const { d } = await open({ build: 'b2', notes: { en: '- one\n- two' } })

    const scrolls = [...d.querySelectorAll<HTMLElement>('*')].filter(el => {
      const style = getComputedStyle(el)
      return (
        ['auto', 'scroll'].includes(style.overflowY) &&
        style.maxHeight !== '' &&
        style.maxHeight !== 'none'
      )
    })
    expect(scrolls).toEqual([
      within(d).getByRole('region', { name: "What's new in Twake Mail" })
    ])
    const content = d.querySelector<HTMLElement>('.MuiDialogContent-root')
    expect(content).not.toBe(null)
    expect(getComputedStyle(content as HTMLElement).overflowY).not.toMatch(
      /auto|scroll/
    )
  })

  it('shows the notes of the last build offered after one was declined', async () => {
    const { fetchServed } = renderDialog({
      build: 'b2',
      notes: { en: 'Notes of two' }
    })
    await check()
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))

    fetchServed.mockResolvedValue({
      build: 'b3',
      notes: { en: 'Notes of three' }
    })
    await check()

    const d = await screen.findByRole('dialog')
    expect(d).toHaveTextContent('Notes of three')
    expect(d).not.toHaveTextContent('Notes of two')
  })
})
