import { afterEach, describe, expect, it, vi } from 'vitest'

import { isUnseen, markSeen, notesFingerprint } from './seenNotes.js'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('notesFingerprint', () => {
  it('is the same whatever the order of the languages', () => {
    expect(notesFingerprint({ en: '- A', fr: '- B' })).toBe(
      notesFingerprint({ fr: '- B', en: '- A' })
    )
  })

  it('is the same whatever the line endings and the blank space around', () => {
    expect(notesFingerprint({ en: '- A\r\n- B \n' })).toBe(
      notesFingerprint({ en: '- A\n- B' })
    )
  })

  it('changes when the text of one language changes', () => {
    expect(notesFingerprint({ en: '- A', fr: '- B' })).not.toBe(
      notesFingerprint({ en: '- A', fr: '- C' })
    )
  })
})

describe('isUnseen and markSeen', () => {
  it('remember the notes under the key of the app, by fingerprint', () => {
    const notes = { en: '- A' }
    expect(isUnseen('mail', notes)).toBe(true)

    markSeen('mail', notes)

    expect(isUnseen('mail', notes)).toBe(false)
    expect(isUnseen('calendar', notes)).toBe(true)
    expect(isUnseen('mail', { en: '- B' })).toBe(true)
    expect(window.localStorage.getItem('twake-new-version:mail')).toBe(
      notesFingerprint(notes)
    )
  })

  it('count the notes as seen when the storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(isUnseen('mail', { en: '- A' })).toBe(false)
  })

  it('ignore a storage that refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => markSeen('mail', { en: '- A' })).not.toThrow()
  })
})
