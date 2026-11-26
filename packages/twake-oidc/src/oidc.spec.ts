import * as client from 'openid-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeLogin,
  getPendingReturnTo,
  LoginRequiredError,
  startLogin
} from './oidc.js'
import { getAccessToken, clearTokenSet } from './session.js'
import { setUpBrowser } from './testUtils.js'

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  clockSkew: Symbol('clockSkew'),
  allowInsecureRequests: vi.fn(),
  randomPKCECodeVerifier: vi.fn(() => 'verifier'),
  randomState: vi.fn(() => 'state'),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue('challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://sso.example.com/auth')),
  authorizationCodeGrant: vi.fn().mockResolvedValue({
    access_token: 'token',
    claims: (): { sub: string } => ({ sub: 'alice' })
  }),
  fetchUserInfo: vi.fn().mockResolvedValue({ sub: 'alice' })
}))

describe('sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenSet()
  })

  it('goes to the SSO and comes back to the page it started from', async () => {
    const { assign } = setUpBrowser('https://app.example.com/contacts/42?q=a')
    await startLogin()
    expect(assign).toHaveBeenCalledWith(new URL('https://sso.example.com/auth'))

    window.location.href = 'https://app.example.com/callback?code=c&state=state'
    const result = await completeLogin()

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      new URL('https://app.example.com/callback?code=c&state=state'),
      { pkceCodeVerifier: 'verifier', expectedState: 'state' }
    )
    expect(result?.userinfo).toEqual({ sub: 'alice' })
    expect(result?.returnTo).toBe('/contacts/42?q=a')
    expect(getAccessToken()).toBe('token')
    expect(sessionStorage.getItem('redirectState')).toBeNull()
  })

  it('exchanges the code at the redirect URI when a backend relays the answer', async () => {
    setUpBrowser('https://app.example.com/contacts', {
      redirectUri: 'https://api.example.com/oidc/callback'
    })
    await startLogin()

    window.location.href = 'https://app.example.com/?code=c&state=state#/users'
    await completeLogin()

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      new URL('https://api.example.com/oidc/callback?code=c&state=state'),
      { pkceCodeVerifier: 'verifier', expectedState: 'state' }
    )
  })

  it('hands the relay values to the backend in the state', async () => {
    setUpBrowser('https://app.example.com/contacts', {
      redirectUri: 'https://api.example.com/oidc/callback',
      relayState: () => ({ origin: window.location.origin, nonce: 'forged' })
    })
    await startLogin()

    const state =
      new URLSearchParams(
        vi.mocked(client.buildAuthorizationUrl).mock.calls[0][1]
      ).get('state') ?? ''
    expect(JSON.parse(Buffer.from(state, 'base64url').toString())).toEqual({
      origin: 'https://app.example.com',
      nonce: 'state'
    })
    expect(state).not.toMatch(/[+/=]/)

    window.location.href = `https://app.example.com/?code=c&state=${state}`
    await completeLogin()

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      expect.any(URL),
      { pkceCodeVerifier: 'verifier', expectedState: state }
    )
  })

  it('reaches an SSO served over plain HTTP', async () => {
    setUpBrowser('https://app.example.com/contacts', {
      ssoUrl: 'http://sso.localhost'
    })
    await startLogin()

    expect(client.discovery).toHaveBeenCalledWith(
      new URL('http://sso.localhost'),
      'app',
      expect.anything(),
      undefined,
      expect.objectContaining({ execute: [client.allowInsecureRequests] })
    )
  })

  it.each(['https://sso.example.com', 'http://sso.example.com'])(
    'keeps insecure requests off for %s',
    async ssoUrl => {
      setUpBrowser('https://app.example.com/contacts', { ssoUrl })
      await startLogin()

      const options = vi.mocked(client.discovery).mock.calls[0][4]
      expect(options?.execute).toBeUndefined()
    }
  )

  it('does not come back to the page a backend relayed the answer to', async () => {
    setUpBrowser('https://app.example.com/?code=spent&state=old', {
      redirectUri: 'https://api.example.com/oidc/callback',
      relayState: () => ({ origin: window.location.origin })
    })
    await startLogin()

    expect(getPendingReturnTo()).toBe('/')
  })

  it('resolves to null when no sign-in is pending', async () => {
    setUpBrowser('https://app.example.com/callback')
    expect(await completeLogin()).toBeNull()
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled()
  })

  it.each([
    ['//evil.com/phish', '/evil.com/phish'],
    ['///evil.com/phish', '/evil.com/phish'],
    // The URL parser turns a backslash in the path into a slash
    ['/\\evil.com/phish', '/evil.com/phish'],
    ['//evil.com/phish?q=a#top', '/evil.com/phish?q=a#top'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com']
  ])('never comes back to another site from %s', async (path, returnTo) => {
    setUpBrowser(`https://app.example.com${path}`)
    await startLogin()

    window.location.href = 'https://app.example.com/callback?code=c&state=state'
    const result = await completeLogin()

    expect(result?.returnTo).toBe(returnTo)
    // Resolved against the application, it stays on the application
    expect(
      new URL(result?.returnTo ?? '', 'https://app.example.com').origin
    ).toBe('https://app.example.com')
  })

  it('does not come back to the redirect URI', async () => {
    setUpBrowser('https://app.example.com/callback?code=spent&state=old')
    await startLogin()

    expect((await completeLogin())?.returnTo).toBe('/')
  })

  it('tells where the pending sign-in comes back, without finishing it', async () => {
    setUpBrowser('https://app.example.com/embed/calendars/team')
    expect(getPendingReturnTo()).toBeNull()

    await startLogin()

    expect(getPendingReturnTo()).toBe('/embed/calendars/team')
    expect(getPendingReturnTo()).toBe('/embed/calendars/team')
  })
})

describe('sign-in in a frame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenSet()
  })

  it('asks the SSO to show nothing, and leaves no history entry', async () => {
    const { assign, replace } = setUpBrowser(
      'https://app.example.com/embed/calendars/team',
      { framed: () => window.location.pathname.startsWith('/embed/') }
    )

    await startLogin()

    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ prompt: 'none' })
    )
    expect(replace).toHaveBeenCalledWith(
      new URL('https://sso.example.com/auth')
    )
    expect(assign).not.toHaveBeenCalled()
  })

  it('signs in as usual outside the frame', async () => {
    const { assign, replace } = setUpBrowser(
      'https://app.example.com/calendar',
      {
        framed: () => window.location.pathname.startsWith('/embed/')
      }
    )

    await startLogin()

    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
      {},
      expect.not.objectContaining({ prompt: 'none' })
    )
    expect(assign).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it.each([
    'login_required',
    'interaction_required',
    'consent_required',
    'account_selection_required'
  ])('reports a silent sign-in the SSO refused with %s', async error => {
    setUpBrowser('https://app.example.com/embed/calendars/team', {
      framed: true
    })
    await startLogin()

    window.location.href = `https://app.example.com/callback?error=${error}&state=state`
    const refused = completeLogin()

    await expect(refused).rejects.toBeInstanceOf(LoginRequiredError)
    await expect(refused).rejects.toMatchObject({
      returnTo: '/embed/calendars/team'
    })
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled()
    expect(getPendingReturnTo()).toBeNull()
  })

  it('takes no refusal for the answer to another sign-in', async () => {
    setUpBrowser('https://app.example.com/embed/calendars/team', {
      framed: true
    })
    await startLogin()

    window.location.href =
      'https://app.example.com/callback?error=login_required&state=other'

    await expect(completeLogin()).resolves.not.toBeNull()
    expect(client.authorizationCodeGrant).toHaveBeenCalled()
  })
})
