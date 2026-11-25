import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'

import { DrivePickerSkeleton } from './DrivePickerSkeleton'

const renderSkeleton = (): HTMLElement => {
  render(
    <TwakeMuiThemeProvider>
      <DrivePickerSkeleton data-testid="drive-skeleton" />
    </TwakeMuiThemeProvider>
  )
  return screen.getByTestId('drive-skeleton')
}

describe('DrivePickerSkeleton', () => {
  it('is hidden from assistive technologies and takes no focus', () => {
    const skeleton = renderSkeleton()

    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(
      skeleton.querySelectorAll('button, a, input, [tabindex]')
    ).toHaveLength(0)
  })
})
