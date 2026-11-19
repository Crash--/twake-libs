import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSdk, MAX_ERROR_MESSAGE, SdkError, type Sdk } from './sdk'
import {
  CREDENTIALS,
  PLATFORM_URL,
  authorizationOf,
  bodyOf,
  json,
  requestsTo,
  stubFetch
} from './testUtils'

const EXCHANGE = { '/auth/token_exchange': (): Response => json(CREDENTIALS) }

const APPS = {
  data: [
    {
      id: 'io.cozy.apps/home',
      type: 'io.cozy.apps',
      attributes: { slug: 'home', name: 'Home', state: 'ready' },
      links: { related: 'https://alice-home.twake.example/' }
    },
    {
      id: 'io.cozy.apps/calendar',
      type: 'io.cozy.apps',
      attributes: {
        slug: 'calendar',
        name: 'Calendar',
        state: 'ready',
        standalone: true,
        client_url_flag: 'calendar.client-url'
      },
      links: { related: 'https://alice-calendar.twake.example/' }
    },
    {
      id: 'io.cozy.apps/hidden',
      type: 'io.cozy.apps',
      attributes: { slug: 'hidden', name: 'Hidden', state: 'ready' },
      links: {}
    }
  ]
}

const flags = (values: Record<string, unknown>): Response =>
  json({ data: { id: 'flags', type: 'io.cozy.settings', attributes: values } })

const loggedIn = async (
  routes: Parameters<typeof stubFetch>[0] = {}
): Promise<{ sdk: Sdk; fetchMock: ReturnType<typeof stubFetch> }> => {
  const fetchMock = stubFetch({ ...EXCHANGE, ...routes })
  const sdk = createSdk({ platformURL: PLATFORM_URL })
  await sdk.login('id-token')
  return { sdk, fetchMock }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('status', () => {
  it('waits for credentials, then falls back to public', () => {
    stubFetch({})
    const sdk = createSdk({ platformURL: PLATFORM_URL, waitingTimeout: 1000 })
    const onChange = vi.fn()
    sdk.onStatusChange(onChange)

    expect(sdk.status).toBe('waiting')
    vi.advanceTimersByTime(1000)
    expect(sdk.status).toBe('public')
    expect(onChange).toHaveBeenCalledWith('public')
  })

  it('is ready once the id token is exchanged', async () => {
    const { sdk } = await loggedIn()

    expect(sdk.status).toBe('ready')
  })

  it('falls back to public and rejects when the first exchange fails', async () => {
    stubFetch({ '/auth/token_exchange': () => json({}, 403) })
    const sdk = createSdk({ platformURL: PLATFORM_URL })

    await expect(sdk.login('id-token')).rejects.toThrow('token_exchange')
    expect(sdk.status).toBe('public')
  })

  it('stays ready when a later exchange fails', async () => {
    const { sdk, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValue(json({}, 403))

    await expect(sdk.login('renewed')).rejects.toThrow('token_exchange')
    expect(sdk.status).toBe('ready')
  })

  it('logs out to public', async () => {
    const { sdk } = await loggedIn()

    sdk.logout()

    expect(sdk.status).toBe('public')
    await expect(sdk.fetch('/apps/')).rejects.toEqual(
      new SdkError('/apps/', 401)
    )
  })
})

describe('app update', () => {
  it('reads the container app once per page, so the platform updates it', async () => {
    const { sdk, fetchMock } = await loggedIn()

    await sdk.login('renewed')

    const requests = requestsTo(fetchMock, '/apps/calendar')
    expect(requests).toHaveLength(1)
    expect(authorizationOf(requests[0])).toBe('Bearer access-1')
  })

  it('reads no app when the token is not linked to one', async () => {
    const fetchMock = stubFetch({
      '/auth/token_exchange': () =>
        json({ ...CREDENTIALS, scope: 'io.cozy.files' })
    })
    const sdk = createSdk({ platformURL: PLATFORM_URL })

    await sdk.login('id-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetch', () => {
  it('sends the bearer token to the platform', async () => {
    const { sdk, fetchMock } = await loggedIn({ '/apps/': () => json(APPS) })

    const response = await sdk.fetch('/apps/')

    expect(response.status).toBe(200)
    const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit]
    expect(url.href).toBe(`${PLATFORM_URL}/apps/`)
    expect(authorizationOf(init)).toBe('Bearer access-1')
  })

  it('refreshes the token once on 401 and retries', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': (_url, init) =>
        authorizationOf(init) === 'Bearer access-2'
          ? json(APPS)
          : json({}, 401),
      '/auth/access_token': () => json({ access_token: 'access-2' })
    })

    const [first, second] = await Promise.all([
      sdk.fetch('/apps/'),
      sdk.fetch('/apps/')
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(1)
    expect(sdk.status).toBe('ready')
  })

  it('logs out when the platform refuses the refresh', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json({}, 401),
      '/auth/access_token': () => json({}, 400)
    })

    await expect(sdk.fetch('/apps/')).rejects.toThrow('access_token')
    expect(sdk.status).toBe('public')
  })

  it.each(['https://elsewhere.example/apps/', '//elsewhere.example/apps/'])(
    'sends nothing out of the platform: %s',
    async path => {
      const { sdk, fetchMock } = await loggedIn({ '/apps/': () => json({}) })

      await expect(sdk.fetch(path)).rejects.toThrow(
        '[twake-sdk] the request leaves the platform'
      )
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => url.host !== new URL(PLATFORM_URL).host
        )
      ).toEqual([])
    }
  )

  it('takes an absolute URL of the platform', async () => {
    const { sdk, fetchMock } = await loggedIn({ '/apps/': () => json({}) })

    await sdk.fetch(`${PLATFORM_URL}/apps/`)

    expect(requestsTo(fetchMock, '/apps/')).toHaveLength(1)
  })

  it('tries the refresh again after a network failure, and stays ready', async () => {
    let attempts = 0
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': (_url, init) =>
        authorizationOf(init) === 'Bearer access-2'
          ? json(APPS)
          : json({}, 401),
      '/auth/access_token': () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        return json({ access_token: 'access-2' })
      }
    })

    const pending = sdk.fetch('/apps/')
    await vi.advanceTimersByTimeAsync(1000)

    expect((await pending).status).toBe(200)
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(2)
    expect(sdk.status).toBe('ready')
  })

  it('logs out when the platform refuses the refresh token with a 401', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': () => json({}, 401),
      '/auth/access_token': () => json({ error: 'invalid_grant' }, 401)
    })

    await expect(sdk.fetch('/apps/')).rejects.toThrow('access_token')
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(1)
    expect(sdk.status).toBe('public')
  })

  // A second exchange gives other credentials: a new session during a refresh
  const relogin = (
    routes: Parameters<typeof stubFetch>[0]
  ): ReturnType<typeof loggedIn> => {
    let exchanges = 0
    return loggedIn({
      '/apps/': (_url, init) =>
        authorizationOf(init) === 'Bearer access-3'
          ? json(APPS)
          : json({}, 401),
      '/auth/token_exchange': () => {
        exchanges += 1
        return json({
          ...CREDENTIALS,
          access_token: exchanges === 1 ? 'access-1' : 'access-3',
          refresh_token: exchanges === 1 ? 'refresh-1' : 'refresh-3'
        })
      },
      ...routes
    })
  }

  it('leaves a session opened during a refresh alone, when the old token is then refused', async () => {
    let answer: ((response: Response) => void) | null = null
    const { sdk, fetchMock } = await relogin({
      '/auth/access_token': () =>
        new Promise<Response>(resolve => {
          answer = resolve
        })
    })

    const pending = sdk.fetch('/apps/')
    pending.catch(() => null)
    await vi.advanceTimersByTimeAsync(0)
    expect(answer).not.toBeNull()
    sdk.logout()
    await sdk.login('id-token-2')
    expect(sdk.status).toBe('ready')
    answer?.(json({ error: 'invalid_grant' }, 400))

    await expect(pending).rejects.toThrow('access_token')
    expect(sdk.status).toBe('ready')
    expect((await sdk.fetch('/apps/')).status).toBe(200)
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(1)
  })

  it('stops the tries once the credentials changed', async () => {
    const { sdk, fetchMock } = await relogin({
      '/auth/access_token': () => {
        throw new TypeError('cut')
      }
    })

    const pending = sdk.fetch('/apps/')
    pending.catch(() => null)
    await vi.advanceTimersByTimeAsync(0)
    sdk.logout()
    await sdk.login('id-token-2')
    await vi.advanceTimersByTimeAsync(3000)

    await expect(pending).rejects.toThrow('cut')
    expect(sdk.status).toBe('ready')
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(1)
  })

  it('gives up after three tries without an answer, keeping the credentials', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': () => json({}, 401),
      '/auth/access_token': () => {
        throw new TypeError('Failed to fetch')
      }
    })

    const pending = sdk.fetch('/apps/')
    pending.catch(() => null)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(pending).rejects.toThrow('Failed to fetch')
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(3)
    expect(sdk.status).toBe('ready')
  })

  it('fetchJSON rejects with the status of a failed request', async () => {
    const { sdk } = await loggedIn({ '/apps/': () => json({}, 500) })

    await expect(sdk.fetchJSON('/apps/')).rejects.toEqual(
      new SdkError('/apps/', 500)
    )
  })
})

describe('platform data', () => {
  it('lists the apps without the hidden ones, once', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () => flags({ 'apps.hidden': ['hidden'] })
    })

    const apps = await sdk.getApps()
    await sdk.getApps()

    expect(apps.map(app => app.slug)).toEqual(['home', 'calendar'])
    expect(apps[0]).toMatchObject({
      id: 'io.cozy.apps/home',
      name: 'Home',
      links: { related: 'https://alice-home.twake.example/' }
    })
    expect(requestsTo(fetchMock, '/apps/')).toHaveLength(1)
  })

  it('merges the instance with its disk usage as numbers', async () => {
    const { sdk } = await loggedIn({
      '/settings/instance': () =>
        json({
          data: {
            id: 'io.cozy.settings.instance',
            type: 'io.cozy.settings',
            attributes: { email: 'alice@example.com', public_name: 'Alice' }
          }
        }),
      '/settings/disk-usage': () =>
        json({
          data: {
            id: 'io.cozy.settings.disk-usage',
            type: 'io.cozy.settings',
            attributes: { used: '1024', quota: '2048' }
          }
        })
    })

    await expect(sdk.getInstance()).resolves.toEqual({
      email: 'alice@example.com',
      public_name: 'Alice',
      diskUsage: 1024,
      diskQuota: 2048
    })
  })

  it('keeps the instance when the disk usage is refused', async () => {
    const { sdk } = await loggedIn({
      '/settings/instance': () =>
        json({
          data: {
            id: 'io.cozy.settings.instance',
            type: 'io.cozy.settings',
            attributes: { public_name: 'Alice' }
          }
        }),
      '/settings/disk-usage': () => json({}, 403)
    })

    await expect(sdk.getInstance()).resolves.toEqual({
      public_name: 'Alice',
      diskUsage: null,
      diskQuota: null
    })
  })

  it('reads the context of the instance', async () => {
    const { sdk } = await loggedIn({
      '/settings/context': () =>
        json({
          data: {
            id: 'io.cozy.settings.context',
            type: 'io.cozy.settings',
            attributes: { help_link: 'https://help.example' }
          }
        })
    })

    await expect(sdk.getContext()).resolves.toEqual({
      help_link: 'https://help.example'
    })
  })

  it('resolves the shortcuts of the Home folder, none without the folder', async () => {
    const { sdk } = await loggedIn({
      '/files/metadata': () =>
        json({
          data: { id: 'home-dir', type: 'io.cozy.files', attributes: {} },
          included: [
            {
              id: 'shortcut-1',
              type: 'io.cozy.files',
              attributes: {
                name: 'Docs.url',
                class: 'shortcut',
                metadata: { icon: 'aWNvbg==', iconMimeType: 'image/png' }
              }
            },
            {
              id: 'shortcut-2',
              type: 'io.cozy.files',
              attributes: {
                name: 'Notes.url',
                class: 'shortcut',
                metadata: { icon: '<svg>Été</svg>' }
              }
            },
            {
              id: 'shortcut-3',
              type: 'io.cozy.files',
              attributes: { name: 'Script.url', class: 'shortcut' }
            },
            {
              id: 'note-1',
              type: 'io.cozy.files',
              attributes: { name: 'Note.md', class: 'text' }
            }
          ]
        }),
      '/shortcuts/shortcut-1': () =>
        json({
          data: {
            id: 'shortcut-1',
            type: 'io.cozy.files.shortcuts',
            attributes: { name: 'Docs.url', url: 'https://docs.example' }
          }
        }),
      '/shortcuts/shortcut-2': () =>
        json({
          data: {
            id: 'shortcut-2',
            type: 'io.cozy.files.shortcuts',
            attributes: { name: 'Notes.url', url: 'http://notes.example' }
          }
        }),
      '/shortcuts/shortcut-3': () =>
        json({
          data: {
            id: 'shortcut-3',
            type: 'io.cozy.files.shortcuts',
            attributes: { name: 'Script.url', url: 'javascript:alert(1)' }
          }
        })
    })

    const shortcuts = await sdk.getShortcuts()
    expect(shortcuts.map(({ icon, ...rest }) => rest)).toEqual([
      { id: 'shortcut-1', name: 'Docs.url', url: 'https://docs.example' },
      { id: 'shortcut-2', name: 'Notes.url', url: 'http://notes.example' }
    ])
    expect(shortcuts[0]?.icon).toBe('data:image/png;base64,aWNvbg==')
    // The SVG, beyond Latin-1, comes back from its UTF-8 bytes
    const [prefix, encoded] = shortcuts[1]?.icon?.split(',') ?? []
    expect(prefix).toBe('data:image/svg+xml;base64')
    expect(
      new TextDecoder().decode(
        Uint8Array.from(atob(encoded ?? ''), char => char.charCodeAt(0))
      )
    ).toBe('<svg>Été</svg>')

    const { sdk: withoutHome } = await loggedIn({})
    await expect(withoutHome.getShortcuts()).resolves.toEqual([])
  })

  it('creates an intent and returns its services', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/intents': () =>
        json({
          data: {
            id: 'intent-1',
            type: 'io.cozy.intents',
            attributes: {
              action: 'PICK',
              type: 'io.cozy.files',
              services: [{ slug: 'drive', href: 'https://drive/pick' }]
            }
          }
        })
    })

    const intent = await sdk.createIntent({
      action: 'PICK',
      type: 'io.cozy.files'
    })

    expect(intent).toMatchObject({
      id: 'intent-1',
      services: [{ slug: 'drive', href: 'https://drive/pick' }]
    })
    const [init] = requestsTo(fetchMock, '/intents')
    expect(bodyOf(init)).toEqual({
      data: {
        type: 'io.cozy.intents',
        attributes: { action: 'PICK', type: 'io.cozy.files' }
      }
    })
  })
})

describe('stackClient', () => {
  it('fetches as cozy-client does, the body as JSON', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/intents': () => json({ data: { id: 'intent-1' } })
    })
    const body = { data: { type: 'io.cozy.intents', attributes: {} } }

    await expect(
      sdk.stackClient.fetchJSON('POST', '/intents', body)
    ).resolves.toEqual({ data: { id: 'intent-1' } })

    const [init] = requestsTo(fetchMock, '/intents')
    expect(init?.method).toBe('POST')
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json')
    expect(bodyOf(init)).toEqual(body)
  })

  it('sends no body without one', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/intents/intent-1': () => json({ data: { id: 'intent-1' } })
    })

    await sdk.stackClient.fetchJSON('GET', '/intents/intent-1')

    const [init] = requestsTo(fetchMock, '/intents/intent-1')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('passes the request options, a body with its Content-Type as it is', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/data/io.cozy.files/_design/a/copy': () => json({ ok: true })
    })

    await sdk.stackClient.fetchJSON(
      'POST',
      '/data/io.cozy.files/_design/a/copy',
      'raw',
      { headers: { Destination: '_design/b', 'Content-Type': 'text/plain' } }
    )

    const [init] = requestsTo(fetchMock, '/data/io.cozy.files/_design/a/copy')
    const headers = new Headers(init?.headers)
    expect(headers.get('Destination')).toBe('_design/b')
    expect(headers.get('Content-Type')).toBe('text/plain')
    expect(init?.body).toBe('raw')
  })

  it('resolves a response without a body', async () => {
    const { sdk } = await loggedIn({
      '/files/f1/relationships/referenced_by': () =>
        new Response(null, { status: 204 })
    })

    await expect(
      sdk.stackClient.fetchJSON(
        'POST',
        '/files/f1/relationships/referenced_by',
        {
          data: []
        }
      )
    ).resolves.toBe('')
  })

  it('resolves a response without a body that says it is JSON', async () => {
    const { sdk } = await loggedIn({
      '/files/f1/relationships/referenced_by': () =>
        new Response(null, {
          status: 204,
          headers: { 'Content-Type': 'application/json' }
        })
    })

    await expect(
      sdk.stackClient.fetchJSON(
        'POST',
        '/files/f1/relationships/referenced_by',
        {
          data: []
        }
      )
    ).resolves.toBe('')
  })

  it('keeps the status of a failure whose JSON is invalid', async () => {
    const { sdk } = await loggedIn({
      '/intents': () =>
        new Response('{', {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
    })

    const error: unknown = await sdk.stackClient
      .fetchJSON('POST', '/intents', {})
      .catch((err: unknown) => err)
    expect(error).toBeInstanceOf(SdkError)
    expect(error).toMatchObject({ status: 503, reason: '{' })
  })

  it('fails on the invalid JSON of a success', async () => {
    const { sdk } = await loggedIn({
      '/intents': () =>
        new Response('{', { headers: { 'Content-Type': 'application/json' } })
    })

    await expect(
      sdk.stackClient.fetchJSON('POST', '/intents', {})
    ).rejects.toBeInstanceOf(SyntaxError)
  })

  it('keeps the whole body but a bounded message', async () => {
    const page = `<html>${'x'.repeat(5000)}</html>`
    const { sdk } = await loggedIn({
      '/intents': () =>
        new Response(page, {
          status: 502,
          headers: { 'Content-Type': 'text/html' }
        })
    })

    const error: unknown = await sdk.stackClient
      .fetchJSON('POST', '/intents', {})
      .catch((err: unknown) => err)
    expect(error).toMatchObject({ status: 502, reason: page })
    expect((error as SdkError).message).toHaveLength(MAX_ERROR_MESSAGE)
  })

  it('rejects with the status and the error of the platform', async () => {
    const { sdk } = await loggedIn({
      '/data/io.cozy.files/x': () =>
        json({ error: 'not_found', reason: 'missing' }, 404)
    })

    const error: unknown = await sdk.stackClient
      .fetchJSON('GET', '/data/io.cozy.files/x')
      .catch((err: unknown) => err)
    expect(error).toBeInstanceOf(SdkError)
    expect(error).toMatchObject({
      status: 404,
      reason: { error: 'not_found', reason: 'missing' }
    })
    // cozy-client's collections recognise a missing document by its message
    expect((error as SdkError).message).toMatch(/not_found/)
  })
})

describe('getAppURL', () => {
  it('opens a standalone app at its client URL when the flag allows it', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () =>
        flags({
          'apps.enable-standalone-apps': true,
          'calendar.client-url': 'https://calendar.twake.example'
        })
    })

    await expect(sdk.getAppURL('calendar', '/#/settings')).resolves.toBe(
      'https://calendar.twake.example/#/settings'
    )
    await expect(sdk.getAppURL('home')).resolves.toBe(
      'https://alice-home.twake.example/'
    )
  })

  it('keeps the platform URL when standalone apps are disabled or the flag is not a URL', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () => flags({ 'calendar.client-url': 'not a url' })
    })

    await expect(sdk.getAppURL('calendar')).resolves.toBe(
      'https://alice-calendar.twake.example/'
    )
    await expect(sdk.getAppURL('missing')).resolves.toBeNull()
  })

  it('resolves the URL of a hidden app', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () =>
        json({
          data: [
            {
              ...APPS.data[2],
              links: { related: 'https://alice-hidden.twake.example/' }
            }
          ]
        }),
      '/settings/flags': () => flags({ 'apps.hidden': ['hidden'] })
    })

    await expect(sdk.getApps()).resolves.toEqual([])
    await expect(sdk.getAppURL('hidden')).resolves.toBe(
      'https://alice-hidden.twake.example/'
    )
  })
})
