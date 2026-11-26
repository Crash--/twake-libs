import { feedbackIntegration } from '@sentry/react'

import type { FeedbackLabels } from './locales.js'

export type FeedbackIntegration = ReturnType<typeof feedbackIntegration>

export type FeedbackIntegrationOptions = Parameters<
  typeof feedbackIntegration
>[0]

/**
 * The Sentry feedback integration, without Sentry's own floating button
 * (`FeedbackButton` replaces it). Synchronous: nothing is loaded from a CDN
 * nor run in a worker, so a strict CSP is enough. Add the result to
 * `integrations` in `Sentry.init`.
 */
export const makeFeedbackIntegration = (
  overrides?: FeedbackIntegrationOptions
): FeedbackIntegration =>
  feedbackIntegration({
    autoInject: false,
    enableScreenshot: true,
    showBranding: false,
    showName: false,
    showEmail: true,
    isEmailRequired: false,
    ...overrides
  })

/**
 * Opens Sentry's form when `el` is clicked.
 * @returns a function detaching it, which also removes the form
 */
export const attachFeedback = (
  integration: FeedbackIntegration,
  el: HTMLElement,
  labels?: Partial<FeedbackLabels>
): (() => void) => integration.attachTo(el, labels)
