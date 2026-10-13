// @vitest-environment jsdom
import * as client from 'openid-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('openid-client', async importOriginal => {
  const actual = await importOriginal<typeof import('openid-client')>()
  return {
    ...actual,
    discovery: vi.fn(),
    buildEndSessionUrl: vi.fn()
  }
})

describe('OIDC Session & Logout', () => {
  let endLocalSession: typeof import('./session').endLocalSession
  let getAccessToken: typeof import('./session').getAccessToken
  let onSessionEndedElsewhere: typeof import('./session').onSessionEndedElsewhere
  let setTokenSet: typeof import('./session').setTokenSet
  let configureAuth: typeof import('./oidc').configureAuth
  let logOut: typeof import('./oidc').logOut
  let assignMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    ;({
      endLocalSession,
      getAccessToken,
      onSessionEndedElsewhere,
      setTokenSet
    } = await import('./session'))
    ;({ configureAuth, logOut } = await import('./oidc'))

    configureAuth({
      ssoUrl: 'https://sso:5554',
      clientId: 'twake-calendar',
      scope: 'openid profile',
      redirectUri: 'http://localhost:8099/callback',
      postLogoutRedirectUri: 'http://localhost:8099/',
      apiUrl: 'http://localhost:8099/api'
    })

    vi.mocked(client.discovery).mockResolvedValue({} as client.Configuration)
    vi.mocked(client.buildEndSessionUrl).mockReturnValue(
      'https://sso:5554/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8099'
    )

    assignMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        assign: assignMock,
        href: 'http://localhost:8099/',
        pathname: '/'
      }
    })
  })

  describe('Local session & BroadcastChannel filtering', () => {
    it('clears the token set locally when endLocalSession is called', () => {
      setTokenSet({ access_token: 'test-token' })
      expect(getAccessToken()).toBe('test-token')

      endLocalSession()

      expect(getAccessToken()).toBeUndefined()
    })

    it('ignores session-ended events sent from the same tab instance', async () => {
      const onEnded = vi.fn()
      onSessionEndedElsewhere(onEnded)

      // Emulate ending local session in current tab
      endLocalSession()

      // Allow tick for BroadcastChannel processing
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onEnded).not.toHaveBeenCalled()
    })

    it('returns an unsubscribe function that closes the channel listener', () => {
      const unsubscribe = onSessionEndedElsewhere(vi.fn())

      expect(typeof unsubscribe).toBe('function')
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe('logOut', () => {
    it('discovers OIDC configuration, clears session locally, and redirects to SSO end-session URL', async () => {
      setTokenSet({ access_token: 'active-token' })

      await logOut()

      expect(client.discovery).toHaveBeenCalledTimes(1)
      expect(client.buildEndSessionUrl).toHaveBeenCalledTimes(1)
      expect(getAccessToken()).toBeUndefined()
      expect(assignMock).toHaveBeenCalledWith(
        'https://sso:5554/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8099'
      )
    })

    it('hands the ID token of the session to the SSO as id_token_hint', async () => {
      setTokenSet({ access_token: 'active-token', id_token: 'id-token' })

      await logOut()

      expect(client.buildEndSessionUrl).toHaveBeenCalledWith(
        {},
        {
          post_logout_redirect_uri: 'http://localhost:8099/',
          id_token_hint: 'id-token'
        }
      )
    })

    it('sends no id_token_hint when this tab holds no ID token', async () => {
      setTokenSet({ access_token: 'active-token' })

      await logOut()

      expect(client.buildEndSessionUrl).toHaveBeenCalledWith(
        {},
        { post_logout_redirect_uri: 'http://localhost:8099/' }
      )
    })

    it('clears session and falls back to "/" when OIDC discovery fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      vi.mocked(client.discovery).mockRejectedValueOnce(
        new TypeError('NetworkError when attempting to fetch resource')
      )

      setTokenSet({ access_token: 'active-token' })

      await logOut()

      expect(getAccessToken()).toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Logout failed:',
        expect.any(Error)
      )
      expect(assignMock).toHaveBeenCalledWith('/')

      consoleErrorSpy.mockRestore()
    })
  })
})
