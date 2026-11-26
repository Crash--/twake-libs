import de from './locales/de.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }
import es from './locales/es.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }
import it from './locales/it.json' with { type: 'json' }
import ru from './locales/ru.json' with { type: 'json' }
import vi from './locales/vi.json' with { type: 'json' }

/** Texts of Sentry's feedback form and trigger, by their Sentry option name */
export const FEEDBACK_LABEL_KEYS = [
  'triggerLabel',
  'triggerAriaLabel',
  'formTitle',
  'messageLabel',
  'messagePlaceholder',
  'emailLabel',
  'emailPlaceholder',
  'submitButtonLabel',
  'cancelButtonLabel',
  'confirmButtonLabel',
  'successMessageText',
  'isRequiredLabel',
  'addScreenshotButtonLabel',
  'removeScreenshotButtonLabel',
  'highlightToolText',
  'hideToolText',
  'removeHighlightText',
  'errorEmptyMessageText',
  'errorNoClientText',
  'errorTimeoutText',
  'errorForbiddenText',
  'errorGenericText'
] as const

export type FeedbackLabelKey = (typeof FEEDBACK_LABEL_KEYS)[number]

/** The texts to give to Sentry's `feedbackIntegration` or `attachTo` */
export type FeedbackLabels = Record<FeedbackLabelKey, string>

export interface FeedbackButtonStrings {
  menuLabel: string
  moveLeft: string
  moveRight: string
  reset: string
}

interface FeedbackLocale {
  twakeFeedback: {
    form: FeedbackLabels
    button: FeedbackButtonStrings
  }
}

const DEFAULT_LANG = 'en'

const locales: Record<string, FeedbackLocale> = {
  de,
  en,
  es,
  fr,
  it,
  ru,
  vi
}

/** `fr-FR`, `fr_FR` or `FR` give the `fr` locale, an unknown one gives `en` */
const getLocale = (lang: string | null | undefined): FeedbackLocale => {
  const short = (lang ?? '').toLowerCase().split(/[-_]/)[0]
  return locales[short] ?? locales[DEFAULT_LANG]
}

/** Sentry's feedback texts in the given language, English when unsupported */
export const getFeedbackLabels = (
  lang: string | null | undefined
): FeedbackLabels => ({ ...getLocale(lang).twakeFeedback.form })

export const getFeedbackButtonStrings = (
  lang: string | null | undefined
): FeedbackButtonStrings => getLocale(lang).twakeFeedback.button
