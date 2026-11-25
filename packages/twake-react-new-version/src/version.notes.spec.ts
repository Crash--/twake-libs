import { describe, expect, it, vi } from 'vitest'

import { fetchServedBuild, fetchServedVersion, notesFor } from './version.js'

const answering =
  (body: string, init: ResponseInit = {}): typeof fetch =>
  () =>
    Promise.resolve(new Response(body, init))

const json = (value: unknown, status = 200): typeof fetch =>
  answering(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })

describe('fetchServedVersion', () => {
  it('reads the build and the notes of /version.json', async () => {
    const served = await fetchServedVersion(
      undefined,
      json({ build: 'b2', notes: { en: '- one', fr: '- un' } })
    )

    expect(served).toEqual({ build: 'b2', notes: { en: '- one', fr: '- un' } })
  })

  it('has no notes when version.json carries none', async () => {
    expect(await fetchServedVersion(undefined, json({ build: 'b2' }))).toEqual({
      build: 'b2',
      notes: null
    })
  })

  it('asks past every cache, at the given URL', async () => {
    const fetchFn = vi.fn(json({ build: 'b2' }))

    await fetchServedVersion('/app/version.json', fetchFn)

    expect(fetchFn).toHaveBeenCalledWith('/app/version.json', {
      cache: 'no-store'
    })
  })

  it.each([
    ['an array', ['- one']],
    ['a number', 3],
    ['a string', '- one'],
    ['null', null],
    ['an empty object', {}],
    ['entries that are not strings', { en: 3, fr: ['x'] }],
    ['empty entries', { en: '', fr: '' }]
  ])('has no notes when notes are %s', async (_, notes) => {
    expect(
      await fetchServedVersion(undefined, json({ build: 'b2', notes }))
    ).toEqual({ build: 'b2', notes: null })
  })

  it('ignores the entries that are not usable strings, keeps the others', async () => {
    const served = await fetchServedVersion(
      undefined,
      json({ build: 'b2', notes: { en: '- one', fr: '', de: 4 } })
    )

    expect(served).toEqual({ build: 'b2', notes: { en: '- one' } })
  })

  it('knows nothing from an error status', async () => {
    expect(
      await fetchServedVersion(undefined, json({ build: 'b2' }, 404))
    ).toBe(null)
  })

  it('knows nothing from a page that is not JSON', async () => {
    const page = answering('<!doctype html><html></html>', {
      headers: { 'content-type': 'text/html' }
    })

    expect(await fetchServedVersion(undefined, page)).toBe(null)
  })

  it.each([{}, { build: '' }, { build: 3 }, null])(
    'knows nothing from %j',
    async body => {
      expect(await fetchServedVersion(undefined, json(body))).toBe(null)
    }
  )

  it('knows nothing when offline, and does not throw', async () => {
    const offline: typeof fetch = () =>
      Promise.reject(new TypeError('Failed to fetch'))

    expect(await fetchServedVersion(undefined, offline)).toBe(null)
  })

  it('leaves fetchServedBuild answering the bare build', async () => {
    expect(
      await fetchServedBuild(
        undefined,
        json({ build: 'b2', notes: { en: '- one' } })
      )
    ).toBe('b2')
  })
})

describe('notesFor', () => {
  const notes = { en: 'english', fr: 'français' }

  it('gives the notes of the language', () => {
    expect(notesFor(notes, 'fr')).toBe('français')
  })

  it('falls back to English', () => {
    expect(notesFor(notes, 'de')).toBe('english')
  })

  it('gives nothing without English nor the language', () => {
    expect(notesFor({ fr: 'français' }, 'de')).toBe(null)
  })

  it('gives nothing without notes', () => {
    expect(notesFor(null, 'en')).toBe(null)
  })
})
