import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startLogin } from './oidc'
import { waitForActivation } from './prerender'
import { setUpBrowser } from './testUtils'

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  clockSkew: Symbol('clockSkew'),
  allowInsecureRequests: vi.fn(),
  randomPKCECodeVerifier: vi.fn(() => 'verifier'),
  randomState: vi.fn(() => 'state'),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue('challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://sso.example.com/auth'))
}))

// A document the browser prerenders, until `activate` shows it to the user
function prerenderedDocument(): { activate: () => void } {
  const listeners: (() => void)[] = []
  const page = {
    prerendering: true,
    addEventListener: (type: string, listener: () => void): void => {
      if (type === 'prerenderingchange') listeners.push(listener)
    }
  }
  vi.stubGlobal('document', page)
  return {
    activate: (): void => {
      page.prerendering = false
      listeners.splice(0).forEach(listener => listener())
    }
  }
}

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('waitForActivation', () => {
  it('resolves at once on a page the user is on', async () => {
    vi.stubGlobal('document', { prerendering: false })
    await expect(waitForActivation()).resolves.toBeUndefined()
  })

  it('resolves at once where there is no document', async () => {
    vi.stubGlobal('document', undefined)
    await expect(waitForActivation()).resolves.toBeUndefined()
  })

  it('waits until the user goes to a prerendered page', async () => {
    const { activate } = prerenderedDocument()
    const activated = vi.fn()
    void waitForActivation().then(activated)

    await settle()
    expect(activated).not.toHaveBeenCalled()

    activate()
    await settle()
    expect(activated).toHaveBeenCalledOnce()
  })
})

describe('startLogin on a prerendered page', () => {
  it('leaves for the SSO only once the user goes to the page', async () => {
    const { assign } = setUpBrowser('https://app.example.com/contacts')
    const { activate } = prerenderedDocument()
    const login = startLogin()

    await settle()
    expect(assign).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('redirectState')).toBeNull()

    activate()
    await login
    expect(assign).toHaveBeenCalledWith(new URL('https://sso.example.com/auth'))
  })
})
