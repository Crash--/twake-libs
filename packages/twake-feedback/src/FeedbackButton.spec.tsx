import { Dialog } from '@linagora/twake-mui'
import { act, fireEvent, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackButton, type FeedbackButtonProps } from './FeedbackButton'
import { renderWithProviders } from './testUtils'

const STORAGE = 'twake-feedback:test'
const VIEWPORT = { width: 1024, height: 768 }
// Default place of the button: 16px from the right and the bottom edges
const DEFAULT_RECT = { left: 952, top: 696 }

const getButton = (): HTMLElement => screen.getByTestId('twake-feedback-button')
const getInsetStyle = (): string | null =>
  document.getElementById('twake-feedback-position')?.textContent ?? null

const setViewport = (width: number, height: number): void => {
  window.innerWidth = width
  window.innerHeight = height
}

/** An `attach` like Sentry's: a bubbling click listener on the element */
const makeAttach = (): {
  attach: FeedbackButtonProps['attach']
  opened: ReturnType<typeof vi.fn>
  detach: ReturnType<typeof vi.fn>
} => {
  const opened = vi.fn()
  const detach = vi.fn()
  const attach = vi.fn((el: HTMLElement) => {
    el.addEventListener('click', opened)
    return (): void => {
      detach()
      el.removeEventListener('click', opened)
    }
  })
  return { attach, opened, detach }
}

const mockRect = (left: number, top: number): void => {
  getButton().getBoundingClientRect = (): DOMRect =>
    ({
      left,
      top,
      right: left + 56,
      bottom: top + 56,
      width: 56,
      height: 56
    }) as DOMRect
}

const drag = (
  to: { x: number; y: number },
  from = { x: 970, y: 720 },
  rect = DEFAULT_RECT
): void => {
  mockRect(rect.left, rect.top)
  const button = getButton()
  fireEvent.pointerDown(button, {
    pointerId: 1,
    clientX: from.x,
    clientY: from.y
  })
  fireEvent.pointerMove(button, { pointerId: 1, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(button, { pointerId: 1, clientX: to.x, clientY: to.y })
}

const flushTimers = (): Promise<void> =>
  act(() => new Promise(resolve => setTimeout(resolve, 0)))

const setup = (
  props: Partial<FeedbackButtonProps> = {},
  lang?: string
): ReturnType<typeof makeAttach> => {
  const fake = makeAttach()
  renderWithProviders(
    <FeedbackButton attach={fake.attach} storageKey="test" {...props} />,
    lang
  )
  return fake
}

describe('FeedbackButton', () => {
  beforeEach(() => setViewport(VIEWPORT.width, VIEWPORT.height))
  afterEach(() => window.localStorage.clear())

  it('is a labelled button opening the form on click', () => {
    const { attach, opened } = setup()

    expect(screen.getByRole('button', { name: 'Something wrong?' })).toBe(
      getButton()
    )
    expect(attach).toHaveBeenCalledWith(getButton())

    fireEvent.click(getButton())

    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('is labelled in the language of the app', () => {
    setup({}, 'fr')

    expect(
      screen.getByRole('button', { name: 'Un problème ?' })
    ).toBeInTheDocument()
  })

  it('stays above an open dialog, and its menu above it', () => {
    renderWithProviders(
      <>
        <FeedbackButton attach={makeAttach().attach} storageKey="test" />
        <Dialog open data-testid="dialog" />
      </>
    )
    fireEvent.contextMenu(getButton())

    // The theme gives MUI's layers as `var(--twake-zIndex-…)`, set on :root
    const zIndexOf = (el: HTMLElement): number => {
      const value = window.getComputedStyle(el).zIndex
      const variable = /^var\((--[^)]+)\)$/.exec(value)?.[1]
      return Number(
        variable
          ? window
              .getComputedStyle(document.documentElement)
              .getPropertyValue(variable)
          : value
      )
    }
    const button = zIndexOf(getButton())

    expect(button).toBeGreaterThan(zIndexOf(screen.getByTestId('dialog')))
    expect(zIndexOf(screen.getByTestId('twake-feedback-menu'))).toBeGreaterThan(
      button
    )
  })

  it('detaches the form and removes its style on unmount', () => {
    const fake = makeAttach()
    const { unmount } = renderWithProviders(
      <FeedbackButton attach={fake.attach} storageKey="test" />
    )

    expect(getInsetStyle()).not.toBeNull()
    unmount()

    expect(fake.detach).toHaveBeenCalledTimes(1)
    expect(getInsetStyle()).toBeNull()
  })

  describe('position', () => {
    it('starts at the bottom right, and the form opens there', () => {
      setup()

      expect(getButton()).toHaveStyle({ right: '16px', bottom: '16px' })
      expect(getInsetStyle()).toBe(
        '#sentry-feedback { --inset: auto 16px 16px auto; }'
      )
    })

    it('keeps the bottom offset free', () => {
      setup({ bottomOffset: 80 })

      expect(getButton()).toHaveStyle({ bottom: '96px' })
      expect(getInsetStyle()).toContain('auto 16px 96px auto')
    })

    it('restores the stored position', () => {
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'left', bottom: 200 })
      )
      const onSideChange = vi.fn()
      setup({ onSideChange })

      expect(getButton()).toHaveStyle({ left: '16px', bottom: '200px' })
      expect(getInsetStyle()).toBe(
        '#sentry-feedback { --inset: auto auto 200px 16px; }'
      )
      expect(onSideChange).toHaveBeenLastCalledWith('left')
    })

    it.each([
      ['not JSON', 'oops'],
      ['an unknown side', JSON.stringify({ side: 'top', bottom: 100 })],
      ['no bottom', JSON.stringify({ side: 'left' })]
    ])('ignores a stored position that is %s', (_, value) => {
      window.localStorage.setItem(STORAGE, value)
      setup()

      expect(getButton()).toHaveStyle({ right: '16px', bottom: '16px' })
    })

    it('clamps a stored position to the viewport', () => {
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'right', bottom: 5000 })
      )
      setup()

      expect(getButton()).toHaveStyle({ bottom: '696px' })
    })

    it('clamps the position when the window shrinks', () => {
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'right', bottom: 600 })
      )
      setup()
      expect(getButton()).toHaveStyle({ bottom: '600px' })

      act(() => {
        setViewport(1024, 400)
        window.dispatchEvent(new Event('resize'))
      })

      expect(getButton()).toHaveStyle({ bottom: '328px' })
      expect(getInsetStyle()).toContain('auto 16px 328px auto')
    })
  })

  describe('drag', () => {
    it('follows the pointer, then snaps to the nearest edge', () => {
      const onSideChange = vi.fn()
      setup({ onSideChange })
      mockRect(DEFAULT_RECT.left, DEFAULT_RECT.top)
      const button = getButton()

      fireEvent.pointerDown(button, {
        pointerId: 1,
        clientX: 970,
        clientY: 720
      })
      fireEvent.pointerMove(button, {
        pointerId: 1,
        clientX: 100,
        clientY: 400
      })

      expect(button).toHaveStyle({ left: '82px', top: '376px' })

      fireEvent.pointerUp(button, { pointerId: 1, clientX: 100, clientY: 400 })

      expect(button).toHaveStyle({ left: '16px', bottom: '336px' })
      expect(getInsetStyle()).toContain('auto auto 336px 16px')
      expect(onSideChange).toHaveBeenLastCalledWith('left')
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE) ?? 'null')
      ).toEqual({ side: 'left', bottom: 336 })
    })

    it('stays in the viewport while dragging', () => {
      setup()
      mockRect(DEFAULT_RECT.left, DEFAULT_RECT.top)
      const button = getButton()

      fireEvent.pointerDown(button, {
        pointerId: 1,
        clientX: 970,
        clientY: 720
      })
      fireEvent.pointerMove(button, {
        pointerId: 1,
        clientX: 5000,
        clientY: -5000
      })

      expect(button).toHaveStyle({ left: '968px', top: '0px' })
    })

    it('snaps to the right edge from the right half', () => {
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'left', bottom: 100 })
      )
      setup()

      drag({ x: 600, y: 300 }, { x: 40, y: 700 }, { left: 16, top: 612 })

      expect(getButton()).toHaveStyle({ right: '16px' })
    })

    it('does not open the form when the click ends a drag', async () => {
      const { opened } = setup()

      drag({ x: 100, y: 400 })
      fireEvent.click(getButton())

      expect(opened).not.toHaveBeenCalled()

      await flushTimers()
      fireEvent.click(getButton())

      expect(opened).toHaveBeenCalledTimes(1)
    })

    it('opens the form for a click that does not move past the threshold', () => {
      const { opened } = setup()

      drag({ x: 973, y: 722 })
      fireEvent.click(getButton())

      expect(opened).toHaveBeenCalledTimes(1)
      expect(getButton()).toHaveStyle({ right: '16px', bottom: '16px' })
      expect(window.localStorage.getItem(STORAGE)).toBeNull()
    })

    it('does not move on a cancelled gesture', () => {
      setup()
      mockRect(DEFAULT_RECT.left, DEFAULT_RECT.top)
      const button = getButton()

      fireEvent.pointerDown(button, {
        pointerId: 1,
        clientX: 970,
        clientY: 720
      })
      fireEvent.pointerMove(button, {
        pointerId: 1,
        clientX: 100,
        clientY: 400
      })
      fireEvent.pointerCancel(button, { pointerId: 1 })

      expect(button).toHaveStyle({ right: '16px', bottom: '16px' })
      expect(window.localStorage.getItem(STORAGE)).toBeNull()
    })
  })

  describe('menu', () => {
    const openMenu = (): void => {
      fireEvent.contextMenu(getButton())
    }

    it('moves the button to the left and to the right', () => {
      const onSideChange = vi.fn()
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'right', bottom: 250 })
      )
      setup({ onSideChange })

      openMenu()
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Move to the left' })
      )

      expect(getButton()).toHaveStyle({ left: '16px', bottom: '250px' })
      expect(getInsetStyle()).toContain('auto auto 250px 16px')
      expect(onSideChange).toHaveBeenLastCalledWith('left')
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE) ?? 'null')
      ).toEqual({ side: 'left', bottom: 250 })

      openMenu()
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Move to the right' })
      )

      expect(getButton()).toHaveStyle({ right: '16px', bottom: '250px' })
      expect(onSideChange).toHaveBeenLastCalledWith('right')
    })

    it('disables the move to the side the button is on', () => {
      setup()

      openMenu()

      expect(
        screen.getByRole('menuitem', { name: 'Move to the right' })
      ).toHaveAttribute('aria-disabled', 'true')
      expect(
        screen.getByRole('menuitem', { name: 'Move to the left' })
      ).not.toHaveAttribute('aria-disabled')
    })

    it('resets the position', () => {
      window.localStorage.setItem(
        STORAGE,
        JSON.stringify({ side: 'left', bottom: 250 })
      )
      setup({ bottomOffset: 40 })

      openMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: 'Reset position' }))

      expect(getButton()).toHaveStyle({ right: '16px', bottom: '56px' })
      expect(window.localStorage.getItem(STORAGE)).toBeNull()
    })

    it('opens with Shift+F10 and the context menu key', () => {
      setup()

      fireEvent.keyDown(getButton(), { key: 'F10', shiftKey: true })
      expect(screen.queryByRole('menu')).toBeInTheDocument()
    })

    it('opens with the context menu key', () => {
      setup()

      fireEvent.keyDown(getButton(), { key: 'ContextMenu' })
      expect(screen.queryByRole('menu')).toBeInTheDocument()
    })

    it('opens on a long press of a finger, without opening the form', () => {
      vi.useFakeTimers()
      try {
        const { opened } = setup()
        mockRect(DEFAULT_RECT.left, DEFAULT_RECT.top)
        const button = getButton()

        fireEvent.pointerDown(button, {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 970,
          clientY: 720
        })
        act(() => {
          vi.advanceTimersByTime(600)
        })
        fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'touch' })
        fireEvent.click(button)

        expect(screen.queryByRole('menu')).toBeInTheDocument()
        expect(opened).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('is translated', () => {
      setup({}, 'fr')

      openMenu()

      expect(
        screen.queryByRole('menuitem', { name: 'Déplacer à gauche' })
      ).toBeInTheDocument()
    })
  })
})
