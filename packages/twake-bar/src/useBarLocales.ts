import { useExtendI18n, useI18n } from 'twake-i18n'

import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'

const locales: Record<string, typeof en> = { de, en, es, fr, it, ru, vi }

/**
 * Adds the bar strings to the host i18n, like the twake-mui components do,
 * in English when the host language is not supported
 */
export const useBarLocales = (): void => {
  const { lang } = useI18n()
  useExtendI18n({ [lang]: locales[lang] ?? locales.en })
}
