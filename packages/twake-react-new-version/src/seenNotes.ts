const STORAGE_PREFIX = 'twake-new-version:'

/**
 * A short fingerprint of the notes in every language (FNV-1a, 32 bits): the
 * same notes give the same one whatever the build or the language shown, and
 * whatever their line endings or surrounding blank space
 */
export const notesFingerprint = (notes: Record<string, string>): string => {
  const text = JSON.stringify(
    Object.keys(notes)
      .sort()
      .map(lang => [lang, notes[lang].replace(/\r\n/g, '\n').trim()])
  )
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * True unless the browser remembers these notes as seen under `key`. False
 * too when the storage cannot be read: notes shown at each load would be worse
 * than notes never shown
 */
export const isUnseen = (
  key: string,
  notes: Record<string, string>
): boolean => {
  try {
    return (
      window.localStorage.getItem(STORAGE_PREFIX + key) !==
      notesFingerprint(notes)
    )
  } catch {
    return false
  }
}

export const markSeen = (key: string, notes: Record<string, string>): void => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, notesFingerprint(notes))
  } catch {
    // A storage the browser refuses: the notes may show again
  }
}
