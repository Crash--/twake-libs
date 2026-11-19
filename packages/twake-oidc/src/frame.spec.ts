import * as client from 'openid-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  relayCallback,
  signInSilently,
  signInWithPopup,
  type SignInResult
} from './frame'
import { LoginRequiredError } from './oidc'
import { clearTokenSet, getAccessToken } from './session'
import { setUpBrowser } from './testUtils'

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

const ORIGIN = 'https://app.example.com'
const ANSWER = `${ORIGIN}/callback?code=c&state=state`

type Listener = (event: MessageEvent) => void

interface Browser {
  deliver: (event: Partial<MessageEvent>) => void
  frame: {
    name: string
    hidden: boolean
    src: string
    contentWindow: object
    remove: ReturnType<typeof vi.fn>
  }
}

// The window stub of setUpBrowser, with messages, a document and a frame
// whose window answers through `answer` once it is shown.
function setUp(answer?: (browser: Browser) => void): Browser {
  setUpBrowser(`${ORIGIN}/contacts`)
  const listeners = new Set<Listener>()
  Object.assign(window, {
    name: '',
    addEventListener: (_type: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) =>
      listeners.delete(listener)
  })
  const browser: Browser = {
    deliver: event => {
      listeners.forEach(listener => listener(event as MessageEvent))
    },
    frame: {
      name: '',
      hidden: false,
      src: '',
      contentWindow: {},
      remove: vi.fn()
    }
  }
  vi.stubGlobal('document', {
    createElement: () => browser.frame,
    body: {
      append: (): void => {
        queueMicrotask(() => answer?.(browser))
      }
    }
  })
  return browser
}

const fromFrame =
  (url: string) =>
  ({ deliver, frame }: Browser): void => {
    deliver({
      origin: ORIGIN,
      source: frame.contentWindow as Window,
      data: { type: 'twake-oidc:sso-callback', url }
    })
  }

beforeEach(() => {
  vi.clearAllMocks()
  clearTokenSet()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('signInSilently', () => {
  it('trades the code the hidden frame hands back', async () => {
    const { frame } = setUp(fromFrame(ANSWER))

    const result: SignInResult = await signInSilently()

    expect(frame).toMatchObject({
      name: 'app-silent-sign-in',
      hidden: true,
      src: 'https://sso.example.com/auth'
    })
    expect(vi.mocked(client.buildAuthorizationUrl).mock.calls[0][1]).toEqual(
      expect.objectContaining({ prompt: 'none' })
    )
    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      new URL(ANSWER),
      {
        pkceCodeVerifier: 'verifier',
        expectedState: 'state'
      }
    )
    expect(result.userinfo).toEqual({ sub: 'alice' })
    expect(getAccessToken()).toBe('token')
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('ignores the messages of other windows and origins', async () => {
    const browser = setUp(b => {
      b.deliver({
        origin: 'https://evil.example.com',
        source: b.frame.contentWindow as Window,
        data: { type: 'twake-oidc:sso-callback', url: `${ORIGIN}/?code=x` }
      })
      b.deliver({
        origin: ORIGIN,
        source: {} as Window,
        data: { type: 'twake-oidc:sso-callback', url: `${ORIGIN}/?code=y` }
      })
      fromFrame(ANSWER)(b)
    })

    await signInSilently()

    expect(client.authorizationCodeGrant).toHaveBeenCalledOnce()
    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      new URL(ANSWER),
      expect.anything()
    )
    expect(browser.frame.remove).toHaveBeenCalledOnce()
  })

  it('refuses with LoginRequiredError when the SSO needs the user', async () => {
    const { frame } = setUp(
      fromFrame(`${ORIGIN}/callback?error=login_required&state=state`)
    )

    await expect(signInSilently()).rejects.toEqual(
      new LoginRequiredError('/contacts')
    )
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled()
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('gives up when the SSO does not answer', async () => {
    vi.useFakeTimers()
    const { frame } = setUp()

    const signIn = signInSilently()
    const refused = expect(signIn).rejects.toThrow('no answer from the SSO')
    await vi.advanceTimersByTimeAsync(10_000)

    await refused
    expect(frame.remove).toHaveBeenCalledOnce()
  })
})

describe('signInWithPopup', () => {
  it('lets the SSO show its portal in a popup, then closes it', async () => {
    const browser = setUp()
    const popup = { location: { href: '' }, close: vi.fn() }
    const open = vi.fn(() => popup)
    Object.assign(window, { open })

    const signIn = signInWithPopup()
    await vi.waitFor(() => {
      expect(popup.location.href).toBe('https://sso.example.com/auth')
    })
    browser.deliver({
      origin: ORIGIN,
      source: popup as unknown as Window,
      data: { type: 'twake-oidc:sso-callback', url: ANSWER }
    })

    await expect(signIn).resolves.toMatchObject({ userinfo: { sub: 'alice' } })
    expect(open).toHaveBeenCalledWith(
      '',
      'app-sign-in',
      'popup,width=480,height=640'
    )
    expect(
      vi.mocked(client.buildAuthorizationUrl).mock.calls[0][1]
    ).not.toHaveProperty('prompt')
    expect(popup.close).toHaveBeenCalledOnce()
  })

  it('refuses when the user closes the popup', async () => {
    vi.useFakeTimers()
    setUp()
    const popup = { location: { href: '' }, closed: false, close: vi.fn() }
    Object.assign(window, { open: () => popup })

    const signIn = signInWithPopup()
    const refused = expect(signIn).rejects.toThrow('popup closed')
    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)

    await refused
  })

  it('refuses when the browser blocks the popup', async () => {
    setUp()
    Object.assign(window, { open: () => null })

    await expect(signInWithPopup()).rejects.toThrow('popup blocked')
  })
})

describe('relayCallback', () => {
  it.each([
    ['app-silent-sign-in', 'parent'],
    ['app-sign-in', 'opener']
  ])('in the window named %s, hands the answer to its %s', (name, to) => {
    setUp()
    const postMessage = vi.fn()
    Object.assign(window, {
      name,
      [to]: { postMessage },
      location: { ...window.location, href: ANSWER }
    })

    expect(relayCallback()).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'twake-oidc:sso-callback', url: ANSWER },
      ORIGIN
    )
  })

  it('does nothing in any other window', () => {
    setUp()

    expect(relayCallback()).toBe(false)
  })

  it('does nothing in a tab that kept the name of the frame', () => {
    setUp()
    Object.assign(window, { name: 'app-silent-sign-in' })
    Object.assign(window, { parent: window })

    expect(relayCallback()).toBe(false)
  })
})
