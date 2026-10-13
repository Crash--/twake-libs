import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('API requests', () => {
  let addAuthorization: typeof import('./http').addAuthorization
  let redirectOnUnauthorized: typeof import('./http').redirectOnUnauthorized
  let oidc: typeof import('./oidc')
  let setTokenSet: typeof import('./session').setTokenSet

  beforeEach(async () => {
    vi.restoreAllMocks()
    // Fresh modules: the redirect in progress is module state
    vi.resetModules()
    ;({ addAuthorization, redirectOnUnauthorized } = await import('./http'))
    oidc = await import('./oidc')
    ;({ setTokenSet } = await import('./session'))
    const { setUpBrowser } = await import('./testUtils')
    setUpBrowser('https://app.example.com/contacts')
  })

  it('hands the access token to the application backend only', () => {
    setTokenSet({ access_token: 'token' })
    const api = new Request('https://api.example.com/users')
    const other = new Request('https://other.example.com/users')

    addAuthorization(api)
    addAuthorization(other)

    expect(api.headers.get('Authorization')).toBe('Bearer token')
    expect(other.headers.has('Authorization')).toBe(false)
  })

  it('signs in again on a 401 from the backend, once', async () => {
    const startLogin = vi.spyOn(oidc, 'startLogin').mockResolvedValue()
    const request = new Request('https://api.example.com/users', {
      headers: { Authorization: 'Bearer expired' }
    })
    const unauthorized = new Response(null, { status: 401 })

    await redirectOnUnauthorized(request, {}, unauthorized)
    await expect(
      redirectOnUnauthorized(request, {}, unauthorized)
    ).rejects.toThrow('SSO redirect in progress')
    expect(startLogin).toHaveBeenCalledTimes(1)
  })

  it('ignores a 401 from another service', async () => {
    const startLogin = vi.spyOn(oidc, 'startLogin').mockResolvedValue()
    const request = new Request('https://other.example.com/users', {
      headers: { Authorization: 'Bearer other' }
    })

    await redirectOnUnauthorized(
      request,
      {},
      new Response(null, { status: 401 })
    )
    expect(startLogin).not.toHaveBeenCalled()
  })

  it('framed, tells the page around the frame once, and does not leave', async () => {
    const onLoginRequired = vi.fn()
    const { setUpBrowser } = await import('./testUtils')
    setUpBrowser('https://app.example.com/embed/calendars/team', {
      framed: true,
      onLoginRequired
    })
    const startLogin = vi.spyOn(oidc, 'startLogin').mockResolvedValue()
    const request = new Request('https://api.example.com/users', {
      headers: { Authorization: 'Bearer expired' }
    })
    const unauthorized = new Response(null, { status: 401 })

    await redirectOnUnauthorized(request, {}, unauthorized)
    await redirectOnUnauthorized(request, {}, unauthorized)

    expect(onLoginRequired).toHaveBeenCalledTimes(1)
    expect(startLogin).not.toHaveBeenCalled()
  })
})
