import { feedbackIntegration } from '@sentry/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { attachFeedback, makeFeedbackIntegration } from './sentry.js'

vi.mock('@sentry/react', () => ({
  feedbackIntegration: vi.fn((options: unknown) => ({ options }))
}))

describe('makeFeedbackIntegration', () => {
  beforeEach(() => vi.mocked(feedbackIntegration).mockClear())

  it('gives the Twake defaults to Sentry', () => {
    makeFeedbackIntegration()

    expect(feedbackIntegration).toHaveBeenCalledWith({
      autoInject: false,
      enableScreenshot: true,
      showBranding: false,
      showName: false,
      showEmail: true,
      isEmailRequired: false
    })
  })

  it('lets the app override them', () => {
    makeFeedbackIntegration({ enableScreenshot: false, colorScheme: 'dark' })

    expect(feedbackIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        autoInject: false,
        enableScreenshot: false,
        colorScheme: 'dark'
      })
    )
  })
})

describe('attachFeedback', () => {
  it('attaches the form to the element with the labels', () => {
    const detach = vi.fn()
    const attachTo = vi.fn(() => detach)
    const integration = { attachTo } as unknown as Parameters<
      typeof attachFeedback
    >[0]
    const el = document.createElement('button')
    const labels = { formTitle: 'Titre' }

    expect(attachFeedback(integration, el, labels)).toBe(detach)
    expect(attachTo).toHaveBeenCalledWith(el, labels)
  })
})
