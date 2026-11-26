import { describe, expect, it } from 'vitest'

import { FEEDBACK_LABEL_KEYS, getFeedbackLabels } from './locales.js'

describe('getFeedbackLabels', () => {
  it.each(['en', 'fr', 'de', 'es', 'it', 'ru', 'vi'])(
    'gives every text in %s',
    lang => {
      const labels = getFeedbackLabels(lang)

      expect(Object.keys(labels).sort()).toEqual(
        [...FEEDBACK_LABEL_KEYS].sort()
      )
      FEEDBACK_LABEL_KEYS.forEach(key => expect(labels[key]).not.toBe(''))
    }
  )

  it('translates', () => {
    expect(getFeedbackLabels('fr').submitButtonLabel).toBe('Envoyer')
    expect(getFeedbackLabels('de').cancelButtonLabel).not.toBe(
      getFeedbackLabels('en').cancelButtonLabel
    )
  })

  it('reads the language of a regional locale', () => {
    expect(getFeedbackLabels('fr-FR')).toEqual(getFeedbackLabels('fr'))
    expect(getFeedbackLabels('pt_BR')).toEqual(getFeedbackLabels('en'))
  })

  it.each(['pt', '', null, undefined])('falls back to English for %s', lang => {
    expect(getFeedbackLabels(lang)).toEqual(getFeedbackLabels('en'))
  })

  it('does not let a caller change the texts', () => {
    getFeedbackLabels('en').formTitle = 'changed'

    expect(getFeedbackLabels('en').formTitle).not.toBe('changed')
  })
})
