/** The window event that asks the dialog to check the served build at once */
export const CHECK_VERSION_EVENT = 'twake:check-version'

/**
 * Asks for a check now: call it when a lazy chunk fails to load, the usual
 * sign of a tab running an older build than the served one
 */
export const requestVersionCheck = (): void => {
  window.dispatchEvent(new Event(CHECK_VERSION_EVENT))
}

/** What `/version.json` says: the build id and, optionally, patch notes by language */
export interface ServedVersion {
  build: string
  /** Notes by language code, null when absent or without a usable entry */
  notes: Record<string, string> | null
}

const usableNotes = (value: unknown): Record<string, string> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].trim() !== ''
  )
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

/**
 * Reads `{ "build": "…", "notes": { "en": "…" } }` at `url`. Null when it
 * cannot tell: an error, the network, or a page that is not that JSON (a dev
 * server answers index.html for any path). Unusable notes are dropped, the
 * build is kept
 */
export const fetchServedVersion = async (
  url = '/version.json',
  fetchFn: typeof fetch = fetch
): Promise<ServedVersion | null> => {
  try {
    const response = await fetchFn(url, { cache: 'no-store' })
    if (!response.ok) return null
    const body = (await response.json()) as {
      build?: unknown
      notes?: unknown
    } | null
    const build = body?.build
    if (typeof build !== 'string' || build === '') return null
    return { build, notes: usableNotes(body?.notes) }
  } catch {
    return null
  }
}

/** The id of the build the server serves now, null when it cannot tell */
export const fetchServedBuild = async (
  url = '/version.json',
  fetchFn: typeof fetch = fetch
): Promise<string | null> =>
  (await fetchServedVersion(url, fetchFn))?.build ?? null

/** The notes in `lang`, else in English, else null */
export const notesFor = (
  notes: Record<string, string> | null,
  lang: string
): string | null => notes?.[lang] ?? notes?.en ?? null

/** True when the server serves a build other than the one running here */
export const isNewBuild = (
  running: string,
  served: string | null
): served is string => served !== null && served !== '' && served !== running
