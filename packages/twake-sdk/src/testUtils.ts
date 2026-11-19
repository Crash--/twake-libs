import { vi, type Mock } from 'vitest'

export const PLATFORM_URL = 'https://alice.twake.example'

export const CREDENTIALS = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  client_id: 'client-id',
  client_secret: 'client-secret',
  scope: '@io.cozy.apps/calendar'
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>
type FetchMock = Mock<(input: URL, init?: RequestInit) => Promise<Response>>

/**
 * Stubs the global fetch with one handler per path, 404 otherwise.
 *
 * @returns the fetch mock, to assert calls
 */
export function stubFetch(routes: Record<string, Route>): FetchMock {
  const fetchMock = vi.fn((input: URL, init: RequestInit = {}) => {
    const route = routes[input.pathname]
    return Promise.resolve(route ? route(input, init) : json({}, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const requestsTo = (
  fetchMock: FetchMock,
  pathname: string
): RequestInit[] =>
  fetchMock.mock.calls
    .filter(([url]) => url.pathname === pathname)
    .map(([, init]) => init ?? {})

export const authorizationOf = (init: RequestInit): string | null =>
  new Headers(init.headers).get('Authorization')

/** JSON body of a request, as sent */
export const bodyOf = (init: RequestInit): unknown =>
  JSON.parse(init.body as string)
