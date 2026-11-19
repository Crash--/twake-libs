import { describe, expect, it } from 'vitest'

import {
  parseAppMessage,
  parseHostMessage,
  parseOverlayRegion
} from './messages.js'

describe('parseAppMessage', () => {
  it('reads a path, replaced unless said otherwise', () => {
    expect(
      parseAppMessage({
        type: 'twake-embed:path',
        resourceId: 'p1',
        path: '/b',
        replace: false
      })
    ).toEqual({
      type: 'twake-embed:path',
      resourceId: 'p1',
      path: '/b',
      replace: false
    })
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: 'p1', path: '' })
    ).toMatchObject({ replace: true })
  })

  it('refuses a path off the route or a missing id', () => {
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: 'p1', path: 'b' })
    ).toBeNull()
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: '', path: '/b' })
    ).toBeNull()
    expect(parseAppMessage({ type: 'twake-embed:path', path: '/b' })).toBeNull()
  })

  it('reads the login and overlay messages', () => {
    expect(parseAppMessage({ type: 'twake-embed:login-required' })).toEqual({
      type: 'twake-embed:login-required'
    })
    expect(
      parseAppMessage({ type: 'twake-embed:overlay-region', region: 'full' })
    ).toEqual({ type: 'twake-embed:overlay-region', region: 'full' })
    expect(
      parseAppMessage({ type: 'twake-embed:overlay-region', region: 'half' })
    ).toBeNull()
  })

  it('reads a request for the whole page of TwakeSpace', () => {
    expect(
      parseAppMessage({ type: 'twake-embed:fill-page', fill: true })
    ).toEqual({ type: 'twake-embed:fill-page', fill: true })
    expect(
      parseAppMessage({ type: 'twake-embed:fill-page', fill: 'yes' })
    ).toBeNull()
  })

  it('reads a call to open in the window of TwakeSpace, http(s) only', () => {
    expect(
      parseAppMessage({
        type: 'twake-embed:pip',
        url: 'https://meet.test/abc-defg-hij'
      })
    ).toEqual({
      type: 'twake-embed:pip',
      url: 'https://meet.test/abc-defg-hij'
    })
    expect(
      parseAppMessage({ type: 'twake-embed:pip', url: 'javascript:alert(1)' })
    ).toBeNull()
    expect(
      parseAppMessage({ type: 'twake-embed:pip', url: '/abc-defg-hij' })
    ).toBeNull()
    expect(parseAppMessage({ type: 'twake-embed:pip', url: 42 })).toBeNull()
    expect(
      parseAppMessage({
        type: 'twake-embed:pip',
        url: `https://m/${'a'.repeat(2048)}`
      })
    ).toBeNull()
  })

  it('reads the counts of the app for its resources', () => {
    const badges = [
      { resourceId: 'mbx-1', count: 3 },
      { resourceId: 'mbx-2', count: 0 }
    ]
    expect(parseAppMessage({ type: 'twake-embed:badges', badges })).toEqual({
      type: 'twake-embed:badges',
      badges
    })
    expect(parseAppMessage({ type: 'twake-embed:badges', badges: [] })).toEqual(
      { type: 'twake-embed:badges', badges: [] }
    )
  })

  it('refuses counts that do not fit', () => {
    const refused = (badges: unknown): void => {
      expect(parseAppMessage({ type: 'twake-embed:badges', badges })).toBeNull()
    }
    refused(undefined)
    refused({ 'mbx-1': 3 })
    refused([{ resourceId: 'mbx-1', count: -1 }])
    refused([{ resourceId: 'mbx-1', count: 1.5 }])
    refused([{ resourceId: 'mbx-1', count: '3' }])
    refused([{ resourceId: 'mbx-1', count: 1_000_001 }])
    refused([{ resourceId: '', count: 1 }])
    refused([{ resourceId: 'x'.repeat(257), count: 1 }])
    refused([{ count: 1 }])
    refused(
      Array.from({ length: 1_001 }, (_, i) => ({
        resourceId: `r${i}`,
        count: 1
      }))
    )
  })

  it('reads the metadata of the app for its resources', () => {
    const metadata = [
      { resourceId: 'p1', name: 'badge', value: 2 },
      { resourceId: 'p1', name: 'tasks.done', value: 0 },
      { resourceId: 'c1', name: 'events.next', value: 'Weekly sync' }
    ]
    expect(parseAppMessage({ type: 'twake-embed:metadata', metadata })).toEqual(
      { type: 'twake-embed:metadata', metadata }
    )
  })

  it('refuses metadata that does not fit', () => {
    const refused = (metadata: unknown): void => {
      expect(
        parseAppMessage({ type: 'twake-embed:metadata', metadata })
      ).toBeNull()
    }
    const entry = { resourceId: 'p1', name: 'tasks.done', value: 1 }
    refused(undefined)
    refused([{ ...entry, value: -1 }])
    refused([{ ...entry, value: 1.5 }])
    refused([{ ...entry, value: 1_000_001 }])
    refused([{ ...entry, value: 'x'.repeat(257) }])
    refused([{ ...entry, value: true }])
    refused([{ ...entry, name: '' }])
    refused([{ ...entry, name: 'Tasks.Done' }])
    refused([{ ...entry, name: 'tasks..done' }])
    refused([{ ...entry, name: 'a'.repeat(65) }])
    refused([{ ...entry, resourceId: '' }])
    refused(Array.from({ length: 1_001 }, () => entry))
  })

  it('reads a notification to show, and one to close', () => {
    const notice = { tag: 'call:!r', title: 'Alice', body: 'is calling you' }
    expect(
      parseAppMessage({ type: 'twake-embed:notification', ...notice })
    ).toEqual({ type: 'twake-embed:notification', ...notice })
    expect(
      parseAppMessage({
        type: 'twake-embed:notification-close',
        tag: 'call:!r'
      })
    ).toEqual({ type: 'twake-embed:notification-close', tag: 'call:!r' })
    // The resource it is about, whose space TwakeSpace opens
    expect(
      parseAppMessage({
        type: 'twake-embed:notification',
        ...notice,
        resourceId: '!space'
      })
    ).toEqual({
      type: 'twake-embed:notification',
      ...notice,
      resourceId: '!space'
    })
  })

  it('refuses notifications that do not fit', () => {
    const refused = (data: Record<string, unknown>): void => {
      expect(
        parseAppMessage({ type: 'twake-embed:notification', ...data })
      ).toBeNull()
    }
    const notice = { tag: 't', title: 'Alice', body: '' }
    refused({ ...notice, tag: '' })
    refused({ ...notice, tag: 'x'.repeat(257) })
    refused({ ...notice, title: '' })
    refused({ ...notice, title: 'x'.repeat(257) })
    refused({ ...notice, body: 'x'.repeat(1_001) })
    refused({ ...notice, body: 3 })
    refused({ ...notice, resourceId: '' })
    refused({ ...notice, resourceId: 3 })
    expect(
      parseAppMessage({ type: 'twake-embed:notification-close', tag: '' })
    ).toBeNull()
  })

  it('ignores anything else', () => {
    expect(parseAppMessage(null)).toBeNull()
    expect(parseAppMessage('twake-embed:path')).toBeNull()
    expect(parseAppMessage({ type: 'twake-tasks:path', path: '/x' })).toBeNull()
  })
})

describe('parseHostMessage', () => {
  it('reads hello', () => {
    expect(parseHostMessage({ type: 'twake-embed:hello' })).toEqual({
      type: 'twake-embed:hello'
    })
  })

  it('reads load and navigate', () => {
    expect(
      parseHostMessage({ type: 'twake-embed:load', resourceId: 'p2', path: '' })
    ).toEqual({ type: 'twake-embed:load', resourceId: 'p2', path: '' })
    expect(
      parseHostMessage({
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '?q=a'
      })
    ).toEqual({ type: 'twake-embed:navigate', resourceId: 'p1', path: '?q=a' })
  })

  it('refuses what does not fit', () => {
    expect(
      parseHostMessage({
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: 'x'
      })
    ).toBeNull()
    expect(
      parseHostMessage({
        type: 'twake-embed:navigate',
        resourceId: 1,
        path: '/'
      })
    ).toBeNull()
    expect(
      parseHostMessage({ type: 'twake-space:theme', theme: 'dark' })
    ).toBeNull()
    expect(
      parseHostMessage({ type: 'twake-embed:path', resourceId: 'p1', path: '' })
    ).toBeNull()
  })

  it('reads an upload of 1 to 100 files', () => {
    const file = new File(['a'], 'a.txt')
    expect(
      parseHostMessage({
        type: 'twake-embed:upload',
        id: 'u1',
        resourceId: 'd1',
        files: [file]
      })
    ).toEqual({
      type: 'twake-embed:upload',
      id: 'u1',
      resourceId: 'd1',
      files: [file]
    })
    const upload = (files: unknown): unknown =>
      parseHostMessage({
        type: 'twake-embed:upload',
        id: 'u1',
        resourceId: 'd1',
        files
      })
    expect(upload([])).toBeNull()
    expect(upload(Array.from({ length: 101 }, () => file))).toBeNull()
    expect(upload(['a.txt'])).toBeNull()
    expect(
      parseHostMessage({
        type: 'twake-embed:upload',
        id: '',
        resourceId: 'd1',
        files: [file]
      })
    ).toBeNull()
  })
})

describe('parseAppMessage upload-done', () => {
  it('reads whether the upload worked', () => {
    expect(
      parseAppMessage({ type: 'twake-embed:upload-done', id: 'u1', ok: true })
    ).toEqual({ type: 'twake-embed:upload-done', id: 'u1', ok: true })
    expect(
      parseAppMessage({ type: 'twake-embed:upload-done', id: 'u1' })
    ).toBeNull()
  })
})

describe('parseOverlayRegion', () => {
  it('bounds the boxes', () => {
    expect(parseOverlayRegion([{ x: 1, y: 2, width: 3, height: 4 }])).toEqual([
      { x: 1, y: 2, width: 3, height: 4 }
    ])
    expect(parseOverlayRegion([])).toEqual([])
    expect(
      parseOverlayRegion([{ x: 1, y: 2, width: -3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: 1e9, y: 2, width: 3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: 'a', y: 2, width: 3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion(
        Array.from({ length: 33 }, () => ({ x: 0, y: 0, width: 1, height: 1 }))
      )
    ).toBeNull()
  })
})
