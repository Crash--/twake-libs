import { useEffect } from 'react'

import { getFormInset, type FeedbackPosition } from './position'

export const FORM_STYLE_ID = 'twake-feedback-position'

/**
 * Moves Sentry's form next to the button: its position comes from the
 * `--inset` variable of `#sentry-feedback`, which page CSS wins over.
 */
export const useFormInset = (
  position: FeedbackPosition,
  viewportHeight: number,
  nonce?: string
): void => {
  const { side, bottom } = position

  useEffect(() => {
    let style = document.getElementById(FORM_STYLE_ID)
    if (!style) {
      style = document.createElement('style')
      style.id = FORM_STYLE_ID
      if (nonce) style.nonce = nonce
      document.head.appendChild(style)
    }
    style.textContent = `#sentry-feedback { --inset: ${getFormInset({ side, bottom }, viewportHeight)}; }`
  }, [side, bottom, viewportHeight, nonce])

  useEffect(
    () => (): void => {
      document.getElementById(FORM_STYLE_ID)?.remove()
    },
    []
  )
}
