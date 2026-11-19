import { afterEach, describe, expect, it, vi } from 'vitest'

import { exchangeIdToken, refreshCredentials, SdkAuthError } from './auth'
import { CREDENTIALS, PLATFORM_URL, bodyOf, json, stubFetch } from './testUtils'

afterEach(() => vi.unstubAllGlobals())

describe('exchangeIdToken', () => {
  it('posts the id token as an app exchange and maps the OAuth client', async () => {
    const fetchMock = stubFetch({
      '/auth/token_exchange': () => json(CREDENTIALS)
    })

    const credentials = await exchangeIdToken(PLATFORM_URL, 'id-token')

    expect(credentials).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      appSlug: 'calendar'
    })
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(bodyOf(init)).toEqual({
      id_token: 'id-token',
      exchange_type: 'app'
    })
  })

  it('rejects with the status when the exchange is refused', async () => {
    stubFetch({
      '/auth/token_exchange': () => json({ error: 'nope' }, 403)
    })

    await expect(exchangeIdToken(PLATFORM_URL, 'id-token')).rejects.toEqual(
      new SdkAuthError('token_exchange', 403)
    )
  })
})

describe('refreshCredentials', () => {
  it('sends the refresh grant as a form and keeps the OAuth client', async () => {
    const fetchMock = stubFetch({
      '/auth/access_token': () => json({ access_token: 'access-2' })
    })
    const credentials = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      appSlug: 'calendar'
    }

    const next = await refreshCredentials(PLATFORM_URL, credentials)

    expect(next).toEqual({ ...credentials, accessToken: 'access-2' })
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(init.body).toBeInstanceOf(URLSearchParams)
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
      client_id: 'client-id',
      client_secret: 'client-secret'
    })
  })
})
