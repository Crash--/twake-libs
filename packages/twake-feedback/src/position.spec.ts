import { describe, expect, it } from 'vitest'

import { getFormInset, snapToEdge } from './position'

describe('snapToEdge', () => {
  const viewport = { width: 1000, height: 800 }

  it('snaps a wide button by its center', () => {
    // Its left edge is left of the middle, its center right of it
    expect(snapToEdge({ left: 420, top: 400 }, viewport, 0, 200).side).toBe(
      'right'
    )
    expect(snapToEdge({ left: 420, top: 400 }, viewport, 0).side).toBe('left')
  })
})

describe('getFormInset', () => {
  it('opens the form upward from a button in the lower half', () => {
    expect(getFormInset({ side: 'right', bottom: 16 }, 800)).toBe(
      'auto 16px 16px auto'
    )
  })

  it('keeps the form at the height of a button with room above it', () => {
    expect(getFormInset({ side: 'left', bottom: 200 }, 800)).toBe(
      'auto auto 200px 16px'
    )
  })

  it('slides the form down from a button moved to the top', () => {
    // 800 - 16 - 520: the form starts 16 px from the top
    expect(getFormInset({ side: 'left', bottom: 728 }, 800)).toBe(
      'auto auto 264px 16px'
    )
  })

  it('keeps the form above the bottom edge on a short viewport', () => {
    // Just above the middle: never anchored by its top, so its buttons stay
    expect(getFormInset({ side: 'right', bottom: 300 }, 500)).toBe(
      'auto 16px 16px auto'
    )
  })
})
