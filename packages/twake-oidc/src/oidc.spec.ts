import * as client from 'openid-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeLogin,
  getPendingReturnTo,
  LoginRequiredError,
  startLogin
} from './oidc'
import { getAccessToken, clearTokenSet } from './session'
import { setUpBrowser } from './testUtils'

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  clockSkew: Symbol('clockSkew'),
  allowInsecureRequests: Symbol('allowInsecureRequests'),
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

describe('SSO over plain HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenSet()
  })

  it('requires HTTPS by default', async () => {
    setUpBrowser('https://app.example.com/', {
      ssoUrl: 'http://127.0.0.1:5556/dex'
    })

    await expect(startLogin()).rejects.toThrow('allowInsecureSso')
    expect(client.discovery).not.toHaveBeenCalled()
  })

  it.each([
    'http://localhost:5556',
    'http://sso.localhost',
    'http://127.0.0.1:5556/dex',
    'http://[::1]:5556'
  ])('lets %s serve plain HTTP with allowInsecureSso', async ssoUrl => {
    const { assign } = setUpBrowser('https://app.example.com/', {
      ssoUrl,
      allowInsecureSso: true
    })

    await startLogin()

    expect(client.discovery).toHaveBeenCalledWith(
      new URL(ssoUrl),
      'app',
      expect.anything(),
      undefined,
      expect.objectContaining({ execute: [client.allowInsecureRequests] })
    )
    expect(assign).toHaveBeenCalled()
  })

  it.each(['http://sso.example.com', 'http://localhost.example.com'])(
    'never lets %s serve plain HTTP',
    async ssoUrl => {
      setUpBrowser('https://app.example.com/', {
        ssoUrl,
        allowInsecureSso: true
      })

      await expect(startLogin()).rejects.toThrow('allowInsecureSso')
      expect(client.discovery).not.toHaveBeenCalled()
    }
  )

  it('keeps HTTPS checks for an SSO served over HTTPS', async () => {
    setUpBrowser('https://app.example.com/', { allowInsecureSso: true })

    await startLogin()

    expect(client.discovery).toHaveBeenCalledWith(
      new URL('https://sso.example.com'),
      'app',
      expect.anything(),
      undefined,
      expect.objectContaining({ execute: [] })
    )
  })
})
