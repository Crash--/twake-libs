import { describe, expect, it, vi } from 'vitest'

import {
  CHECK_VERSION_EVENT,
  fetchServedBuild,
  isNewBuild,
  requestVersionCheck
} from './version'

const answering =
  (body: string, init: ResponseInit = {}): typeof fetch =>
  () =>
    Promise.resolve(new Response(body, init))

const json = (value: unknown, status = 200): typeof fetch =>
  answering(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })

describe('fetchServedBuild', () => {
  it('reads the build of /version.json', async () => {
    expect(await fetchServedBuild(undefined, json({ build: 'b2' }))).toBe('b2')
  })

  // A cached answer would hide the very deployment it looks for
  it('asks past every cache, at the given URL', async () => {
    const fetchFn = vi.fn(json({ build: 'b2' }))

    await fetchServedBuild('/app/version.json', fetchFn)

    expect(fetchFn).toHaveBeenCalledWith('/app/version.json', {
      cache: 'no-store'
    })
  })

  it('knows nothing from an error status', async () => {
    expect(await fetchServedBuild(undefined, json({ build: 'b2' }, 404))).toBe(
      null
    )
  })

  it('knows nothing from a page that is not JSON', async () => {
    const page = answering('<!doctype html><html></html>', {
      headers: { 'content-type': 'text/html' }
    })

    expect(await fetchServedBuild(undefined, page)).toBe(null)
  })

  it.each([{}, { build: '' }, { build: 3 }, null])(
    'knows nothing from %j',
    async body => {
      expect(await fetchServedBuild(undefined, json(body))).toBe(null)
    }
  )

  it('knows nothing when offline, and does not throw', async () => {
    const offline: typeof fetch = () =>
      Promise.reject(new TypeError('Failed to fetch'))

    expect(await fetchServedBuild(undefined, offline)).toBe(null)
  })
})

describe('isNewBuild', () => {
  it('is true for another served build', () => {
    expect(isNewBuild('b1', 'b2')).toBe(true)
  })

  it.each(['b1', null, ''])('is false for %j', served => {
    expect(isNewBuild('b1', served)).toBe(false)
  })
})

it('requestVersionCheck sends the check event on window', () => {
  const listener = vi.fn()
  window.addEventListener(CHECK_VERSION_EVENT, listener)

  requestVersionCheck()

  expect(listener).toHaveBeenCalledTimes(1)
  window.removeEventListener(CHECK_VERSION_EVENT, listener)
})
