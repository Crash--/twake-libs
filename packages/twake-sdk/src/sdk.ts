import { exchangeIdToken, refreshCredentials, SdkAuthError } from './auth'
import type {
  App,
  Context,
  Credentials,
  Flags,
  Instance,
  Intent,
  IntentRequest,
  SdkOptions,
  SdkStatus,
  Shortcut
} from './types'

/** Default delay before a client left `waiting` falls back to `public` */
export const WAITING_TIMEOUT = 30000

/** Delay before a refresh the platform did not answer is tried again */
export const REFRESH_RETRY_DELAY = 1000
const REFRESH_ATTEMPTS = 3

const HOME_SHORTCUTS_PATH = '/Settings/Home'
const STANDALONE_APPS_FLAG = 'apps.enable-standalone-apps'
const HIDDEN_APPS_FLAG = 'apps.hidden'

export class SdkError extends Error {
  readonly status: number
  /** The body of the failed response, read by `stackClient.fetchJSON` */
  readonly reason?: unknown

  constructor(path: string, status: number, reason?: unknown) {
    super(
      (reason === undefined ? '' : reasonMessage(reason)) ||
        `[twake-sdk] ${path} failed: ${status}`
    )
    this.name = 'SdkError'
    this.status = status
    this.reason = reason
  }
}

/** Longest message taken from a response, as an HTML error page */
export const MAX_ERROR_MESSAGE = 1000

// cozy-client's message for a failed response: callers match it (not_found)
const reasonMessage = (reason: unknown): string => {
  const message =
    typeof reason === 'string'
      ? reason
      : typeof reason === 'object' &&
          reason !== null &&
          'message' in reason &&
          typeof reason.message === 'string'
        ? reason.message
        : JSON.stringify(reason)
  return message.slice(0, MAX_ERROR_MESSAGE)
}

// As cozy-client reads a body: JSON when the response says so, text otherwise.
// A response without a body, as a 204, gives an empty text whatever it says.
const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  const isJson = /\bapplication\/(vnd\.api\+)?json\b/.test(
    response.headers.get('Content-Type') ?? ''
  )
  if (!isJson || text === '') return text
  try {
    return JSON.parse(text) as unknown
  } catch (err: unknown) {
    // A failure keeps its status and its text; a success that cannot be read fails
    if (!response.ok) return text
    throw err
  }
}

export interface Sdk {
  readonly platformURL: string
  readonly status: SdkStatus
  /** @returns a function that stops listening */
  onStatusChange(listener: (status: SdkStatus) => void): () => void
  /** Exchanges the id token, resolves once the client is `ready` */
  login(idToken: string): Promise<void>
  /** Forgets the credentials: cannot fail, the SSO ends the OAuth client itself */
  logout(): void
  /** `window.fetch` on the platform: base URL, bearer, 401 refreshed once */
  fetch(path: string, init?: RequestInit): Promise<Response>
  fetchJSON<T>(path: string, init?: RequestInit): Promise<T>
  /**
   * `fetchJSON` as cozy-client's stack client has it, for the libraries made
   * for cozy-client: `new Intents({ client: sdk })` of cozy-interapp
   */
  readonly stackClient: {
    fetchJSON<T>(
      method: string,
      path: string,
      body?: unknown,
      options?: RequestInit
    ): Promise<T>
  }
  /** Installed apps, without the ones hidden by the `apps.hidden` flag */
  getApps(): Promise<App[]>
  /** Installed apps, hidden ones included */
  getAllApps(): Promise<App[]>
  /** The instance, with its disk usage when the app may read it */
  getInstance(): Promise<Instance>
  getContext(): Promise<Context>
  getFlags(): Promise<Flags>
  /** Shortcuts of the Home folder */
  getShortcuts(): Promise<Shortcut[]>
  /** Blob URL of the app icon, revoked by `logout` */
  getAppIconURL(slug: string): Promise<string>
  /**
   * URL of an installed app, hidden or not, null otherwise. Standalone apps
   * open at their client URL
   */
  getAppURL(slug: string, path?: string): Promise<string | null>
  createIntent(request: IntentRequest): Promise<Intent>
}

interface JsonApiDoc<A> {
  id: string
  type: string
  attributes: A
  links?: Record<string, string>
}

interface JsonApiResponse<D, I = Record<string, unknown>> {
  data: D
  included?: JsonApiDoc<I>[]
}

interface FileAttributes {
  name: string
  class?: string
  metadata?: { icon?: string; iconMimeType?: string }
}

// `btoa` takes Latin-1 only: the text goes through its UTF-8 bytes
const base64 = (text: string): string =>
  btoa(
    Array.from(new TextEncoder().encode(text), byte =>
      String.fromCharCode(byte)
    ).join('')
  )

/**
 * Without an icon mime type the icon is a plain SVG, otherwise it comes from
 * the Iconizer API already in base64
 */
const shortcutIcon = ({ metadata }: FileAttributes): string | null => {
  if (!metadata?.icon) return null
  return metadata.iconMimeType
    ? `data:${metadata.iconMimeType};base64,${metadata.icon}`
    : `data:image/svg+xml;base64,${base64(metadata.icon)}`
}

interface DiskUsageAttributes {
  used: string
  quota?: string
}

const isHttpURL = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//.test(value)

const flatten = <A extends object>(
  doc: JsonApiDoc<A>
): A & { id: string; links: Record<string, string> } => ({
  ...doc.attributes,
  id: doc.id,
  links: doc.links ?? {}
})

export function createSdk(options: SdkOptions): Sdk {
  const { platformURL, waitingTimeout = WAITING_TIMEOUT } = options
  let credentials: Credentials | null = null
  let status: SdkStatus = 'waiting'
  let waitingTimer: ReturnType<typeof setTimeout> | null = null
  let refreshing: Promise<Credentials> | null = null
  let appUpdateRequested = false
  const listeners = new Set<(status: SdkStatus) => void>()
  // Platform data for the page lifetime, keyed by request path
  const cache = new Map<string, Promise<unknown>>()
  const iconURLs = new Map<string, Promise<string>>()

  const setStatus = (next: SdkStatus): void => {
    if (waitingTimer) clearTimeout(waitingTimer)
    waitingTimer = null
    if (next === 'waiting') {
      waitingTimer = setTimeout(() => setStatus('public'), waitingTimeout)
    }
    if (next === status) return
    status = next
    for (const listener of listeners) listener(status)
  }

  const login = async (idToken: string): Promise<void> => {
    if (!credentials) setStatus('waiting')
    try {
      credentials = await exchangeIdToken(platformURL, idToken)
    } catch (err: unknown) {
      if (!credentials) setStatus('public')
      throw err
    }
    setStatus('ready')
    // The stack lazy-updates an app when it serves its index, never for a
    // standalone client: reading the app manifest does it, once per page
    if (credentials.appSlug && !appUpdateRequested) {
      appUpdateRequested = true
      sdkFetch(`/apps/${credentials.appSlug}`).catch(() => null)
    }
  }

  const logout = (): void => {
    credentials = null
    refreshing = null
    cache.clear()
    for (const url of iconURLs.values()) {
      url.then(value => URL.revokeObjectURL(value)).catch(() => null)
    }
    iconURLs.clear()
    setStatus('public')
  }

  // The platform refused the refresh token: the credentials are over
  const refused = (err: unknown): boolean =>
    err instanceof SdkAuthError && (err.status === 400 || err.status === 401)

  // Any other failure (a network error, a 502) is tried again after a delay,
  // a few times, while the credentials are still the ones being refreshed
  const refreshWithRetries = async (
    current: Credentials
  ): Promise<Credentials> => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await refreshCredentials(platformURL, current)
      } catch (err: unknown) {
        if (refused(err) || attempt === REFRESH_ATTEMPTS) throw err
        await new Promise(resolve => setTimeout(resolve, REFRESH_RETRY_DELAY))
        if (credentials !== current) throw err
      }
    }
  }

  const refresh = (): Promise<Credentials> => {
    // Concurrent 401s share one refresh
    if (!refreshing) {
      const current = credentials
      if (!current) return Promise.reject(new SdkError('access_token', 401))
      // A logout, or a new login, during the retries: this refresh is then
      // about credentials that are over, and leaves the new ones alone
      const pending: Promise<Credentials> = refreshWithRetries(current)
        .then(next => {
          if (credentials === current) credentials = next
          return next
        })
        .catch((err: unknown) => {
          if (refused(err) && credentials === current) logout()
          throw err
        })
        .finally(() => {
          if (refreshing === pending) refreshing = null
        })
      refreshing = pending
    }
    return refreshing
  }

  const send = (
    path: string,
    init: RequestInit,
    token: string
  ): Promise<Response> => {
    const url = new URL(path, platformURL)
    // The token is for the platform only
    if (url.origin !== new URL(platformURL).origin) {
      return Promise.reject(
        new Error('[twake-sdk] the request leaves the platform')
      )
    }
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }

  const sdkFetch = async (
    path: string,
    init: RequestInit = {}
  ): Promise<Response> => {
    if (!credentials) throw new SdkError(path, 401)
    const response = await send(path, init, credentials.accessToken)
    if (response.status !== 401) return response
    const next = await refresh()
    return send(path, init, next.accessToken)
  }

  const fetchJSON = async <T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(init.headers)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    const response = await sdkFetch(path, { ...init, headers })
    if (!response.ok) throw new SdkError(path, response.status)
    return (await response.json()) as T
  }

  const stackClient = {
    fetchJSON: async <T>(
      method: string,
      path: string,
      body?: unknown,
      options: RequestInit = {}
    ): Promise<T> => {
      const headers = new Headers(options.headers)
      headers.set('Accept', 'application/json')
      // A body with its own Content-Type goes as it is
      let payload = body as BodyInit | undefined
      if (body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
        payload = JSON.stringify(body)
      }
      const response = await sdkFetch(path, {
        ...options,
        method,
        headers,
        body: payload
      })
      const data = await readBody(response)
      if (!response.ok) throw new SdkError(path, response.status, data)
      return data as T
    }
  }

  const cached = <T>(path: string, load: () => Promise<T>): Promise<T> => {
    let pending = cache.get(path) as Promise<T> | undefined
    if (!pending) {
      pending = load().catch((err: unknown) => {
        cache.delete(path)
        throw err
      })
      cache.set(path, pending)
    }
    return pending
  }

  const getFlags = (): Promise<Flags> =>
    cached('/settings/flags', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<Flags>>>('/settings/flags')
      return data.attributes
    })

  const getAllApps = (): Promise<App[]> =>
    cached('/apps/', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<App>[]>>('/apps/')
      return data.map(flatten)
    })

  const getApps = async (): Promise<App[]> => {
    const [apps, flags] = await Promise.all([getAllApps(), getFlags()])
    const hidden = flags[HIDDEN_APPS_FLAG]
    const hiddenSlugs = Array.isArray(hidden) ? hidden : []
    return apps.filter(app => !hiddenSlugs.includes(app.slug))
  }

  const getInstance = (): Promise<Instance> =>
    cached('/settings/instance', async () => {
      const [instance, diskUsage] = await Promise.all([
        fetchJSON<JsonApiResponse<JsonApiDoc<Record<string, unknown>>>>(
          '/settings/instance'
        ),
        // Its own permission: an app without it still has an instance
        fetchJSON<JsonApiResponse<JsonApiDoc<DiskUsageAttributes>>>(
          '/settings/disk-usage'
        ).catch(() => null)
      ])
      const { used, quota } = diskUsage?.data.attributes ?? {}
      return {
        ...instance.data.attributes,
        diskUsage: used ? Number(used) : null,
        diskQuota: quota ? Number(quota) : null
      }
    })

  const getContext = (): Promise<Context> =>
    cached('/settings/context', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<Context>>>(
          '/settings/context'
        )
      return data.attributes
    })

  const getShortcuts = (): Promise<Shortcut[]> =>
    cached('/shortcuts', async () => {
      const path = `/files/metadata?Path=${encodeURIComponent(HOME_SHORTCUTS_PATH)}`
      let included: JsonApiDoc<FileAttributes>[]
      try {
        ;({ included = [] } =
          await fetchJSON<
            JsonApiResponse<JsonApiDoc<FileAttributes>, FileAttributes>
          >(path))
      } catch (err: unknown) {
        // No Home folder yet: no shortcuts
        if (err instanceof SdkError && err.status === 404) return []
        throw err
      }
      const files = included.filter(
        file => file.attributes.class === 'shortcut'
      )
      const shortcuts = await Promise.all(
        files.map(async file => {
          const { data } = await fetchJSON<
            JsonApiResponse<JsonApiDoc<{ name: string; url: string }>>
          >(`/shortcuts/${file.id}`)
          return {
            id: file.id,
            name: data.attributes.name,
            url: data.attributes.url,
            icon: shortcutIcon(file.attributes)
          }
        })
      )
      // A shortcut file holds any text: the web ones are listed
      return shortcuts.filter(shortcut => isHttpURL(shortcut.url))
    })

  const getAppIconURL = (slug: string): Promise<string> => {
    let pending = iconURLs.get(slug)
    if (!pending) {
      pending = sdkFetch(`/apps/${slug}/icon`).then(async response => {
        if (!response.ok)
          throw new SdkError(`/apps/${slug}/icon`, response.status)
        return URL.createObjectURL(await response.blob())
      })
      pending.catch(() => iconURLs.delete(slug))
      iconURLs.set(slug, pending)
    }
    return pending
  }

  const getAppURL = async (slug: string, path = ''): Promise<string | null> => {
    const [apps, flags] = await Promise.all([getAllApps(), getFlags()])
    const app = apps.find(candidate => candidate.slug === slug)
    if (!app) return null
    let base = app.links.related
    if (
      app.standalone === true &&
      app.client_url_flag &&
      flags[STANDALONE_APPS_FLAG]
    ) {
      const clientURL = flags[app.client_url_flag]
      if (isHttpURL(clientURL)) base = clientURL
    }
    if (!base) return null
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  const createIntent = async (request: IntentRequest): Promise<Intent> => {
    const { data } = await fetchJSON<JsonApiResponse<JsonApiDoc<Intent>>>(
      '/intents',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: { type: 'io.cozy.intents', attributes: request }
        })
      }
    )
    return flatten(data)
  }

  setStatus('waiting')
  if (options.idToken) login(options.idToken).catch(() => null)

  return {
    platformURL,
    get status(): SdkStatus {
      return status
    },
    onStatusChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    login,
    logout,
    fetch: sdkFetch,
    fetchJSON,
    stackClient,
    getApps,
    getAllApps,
    getInstance,
    getContext,
    getFlags,
    getShortcuts,
    getAppIconURL,
    getAppURL,
    createIntent
  }
}
