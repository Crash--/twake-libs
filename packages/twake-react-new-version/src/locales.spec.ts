import { expect, it } from 'vitest'

import de from './locales/de.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }
import es from './locales/es.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }
import it_ from './locales/it.json' with { type: 'json' }
import ru from './locales/ru.json' with { type: 'json' }
import vi from './locales/vi.json' with { type: 'json' }

const texts = Object.entries({ de, en, es, fr, it: it_, ru, vi })

it('has the seven languages', () => {
  expect(texts.map(([lang]) => lang).sort()).toEqual([
    'de',
    'en',
    'es',
    'fr',
    'it',
    'ru',
    'vi'
  ])
})

it.each(texts)('%s has every text, naming the app', (_, locale) => {
  const { twakeNewVersion } = locale

  expect(Object.keys(twakeNewVersion).sort()).toEqual(
    Object.keys(en.twakeNewVersion).sort()
  )
  Object.values(twakeNewVersion).forEach(text => expect(text).not.toBe(''))
  expect(twakeNewVersion.title).toContain('%{appName}')
  expect(typeof twakeNewVersion.body).toBe('string')
  expect(twakeNewVersion.body.length).toBeGreaterThan(0)
})
