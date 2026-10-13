import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock
} from 'vitest'

import { connectToTwakeSpace, type TwakeSpaceConnection } from './app.js'

const HOST = 'https://space.test'
const PREFIX = '/embed/projects/'

const posts = new WeakMap<Window, Mock>()

function fakeParent(): Window {
  const post = vi.fn()
  const parent = { postMessage: post } as unknown as Window
  posts.set(parent, post)
  return parent
}

// What the app posted, apart from asking for the greeting
function posted(parent: Window): unknown[][] {
  return ((posts.get(parent)?.mock.calls ?? []) as unknown[][]).filter(
    ([data]) => (data as { type: string }).type !== 'twake-embed:ready'
  )
}

function asked(parent: Window): number {
  return ((posts.get(parent)?.mock.calls ?? []) as unknown[][]).filter(
    ([data, target]) =>
      (data as { type: string }).type === 'twake-embed:ready' && target === '*'
  ).length
}

function fromHost(parent: Window, data: unknown, origin = HOST): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: parent })
  )
}

const hello = { type: 'twake-embed:hello' }

function connect(
  parent: Window,
  pathname = '/embed/projects/p1',
  hostOrigins?: string[]
): TwakeSpaceConnection | null {
  window.history.replaceState(null, '', pathname)
  return connectToTwakeSpace({ embedPrefix: PREFIX, parent, hostOrigins })
}

describe('connectToTwakeSpace', () => {
  let space: TwakeSpaceConnection | null = null
  afterEach(() => {
    space?.disconnect()
    space = null
  })

  it('does nothing out of a frame, or with no host allowed', () => {
    window.history.replaceState(null, '', '/embed/projects/p1')
    expect(connectToTwakeSpace({ embedPrefix: PREFIX })).toBeNull()
    expect(connect(fakeParent(), '/embed/projects/p1', [])).toBeNull()
  })

  it('asks whoever framed it for the greeting, until it comes', () => {
    const parent = fakeParent()
    space = connect(parent)
    if (!space) throw new Error('not connected')
    expect(asked(parent)).toBe(1)

    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    expect(asked(parent)).toBe(2)

    fromHost(parent, hello)
    space.disconnect()
    space = connect(parent)
    if (!space) throw new Error('not connected')
    fromHost(parent, hello)
    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    // Greeted already: no need to ask again
    expect(asked(parent)).toBe(3)
  })

  it('says nothing until the host greets it, then answers that host', () => {
    const parent = fakeParent()
    space = connect(parent, '/embed/projects/p1/boards/b1?task=T-1')
    if (!space) throw new Error('not connected')
    space.notifyLoginRequired()
    space.reportOverlayRegion('full')
    space.fillPage(true)
    space.openPip('https://meet.test/abc-defg-hij')
    expect(posted(parent)).toEqual([])
    expect(space.hostOrigin()).toBeNull()

    fromHost(parent, hello, 'https://another-space.test')
    expect(space.hostOrigin()).toBe('https://another-space.test')
    space.notifyLoginRequired()
    space.reportOverlayRegion('full')
    space.fillPage(true)
    space.openPip('https://meet.test/abc-defg-hij')
    expect(posted(parent)).toEqual([
      [{ type: 'twake-embed:login-required' }, 'https://another-space.test'],
      [
        { type: 'twake-embed:overlay-region', region: 'full' },
        'https://another-space.test'
      ],
      [
        { type: 'twake-embed:fill-page', fill: true },
        'https://another-space.test'
      ],
      [
        { type: 'twake-embed:pip', url: 'https://meet.test/abc-defg-hij' },
        'https://another-space.test'
      ]
    ])
  })

  it('learns the host from any of its messages, never from another window', () => {
    const parent = fakeParent()
    space = connect(parent)
    if (!space) throw new Error('not connected')

    window.dispatchEvent(
      new MessageEvent('message', { data: hello, origin: HOST, source: window })
    )
    fromHost(parent, { type: 'not-twake' })
    expect(space.hostOrigin()).toBeNull()

    fromHost(parent, {
      type: 'twake-embed:navigate',
      resourceId: 'p1',
      path: ''
    })
    expect(space.hostOrigin()).toBe(HOST)
  })

  it('reports the counts, and the last ones again to a host that greets later', () => {
    const parent = fakeParent()
    const space = connect(parent)
    const badges = [{ resourceId: 'p1', count: 2 }]

    space?.reportBadges(badges)
    expect(posted(parent)).toEqual([])

    fromHost(parent, hello)
    expect(posted(parent)).toContainEqual([
      { type: 'twake-embed:badges', badges },
      HOST
    ])

    space?.reportBadges([])
    expect(posted(parent).at(-1)).toEqual([
      { type: 'twake-embed:badges', badges: [] },
      HOST
    ])
    space?.disconnect()
  })

  it('reports the metadata, and the last ones again to a host that greets later', () => {
    const parent = fakeParent()
    const space = connect(parent)
    const metadata = [{ resourceId: 'p1', name: 'badge', value: 2 }]

    space?.reportMetadata(metadata)
    expect(posted(parent)).toEqual([])

    fromHost(parent, hello)
    expect(posted(parent)).toContainEqual([
      { type: 'twake-embed:metadata', metadata },
      HOST
    ])
    space?.disconnect()
  })

  it('asks the host to show a notification and to close it, never again later', () => {
    const parent = fakeParent()
    const space = connect(parent)
    const notice = { tag: 'call:!r', title: 'Alice', body: 'is calling you' }

    // Of the moment: lost before the host greets
    space?.notify(notice)
    fromHost(parent, hello)
    expect(posted(parent)).not.toContainEqual([
      { type: 'twake-embed:notification', ...notice },
      HOST
    ])

    space?.notify(notice)
    space?.closeNotification('call:!r')
    expect(posted(parent).slice(-2)).toEqual([
      [{ type: 'twake-embed:notification', ...notice }, HOST],
      [{ type: 'twake-embed:notification-close', tag: 'call:!r' }, HOST]
    ])
    space?.disconnect()
  })

  it('keeps to the hosts given, when some are', () => {
    const parent = fakeParent()
    space = connect(parent, '/embed/projects/p1', [HOST])
    if (!space) throw new Error('not connected')

    fromHost(parent, hello, 'https://evil.test')
    expect(space.hostOrigin()).toBeNull()
    fromHost(parent, hello)
    expect(space.hostOrigin()).toBe(HOST)
  })

  describe('syncHistory', () => {
    let parent: Window
    let stop: () => void
    const handlers = {
      onLoad:
        vi.fn<(resourceId: string, path: string) => void | Promise<void>>(),
      onNavigate:
        vi.fn<(resourceId: string, path: string) => void | Promise<void>>()
    }

    beforeEach(() => {
      parent = fakeParent()
      const connected = connect(parent)
      if (!connected) throw new Error('not connected')
      space = connected
      stop = space.syncHistory(handlers)
      fromHost(parent, hello)
    })

    it('reports the URL as a replace once the host greets it', () => {
      expect(posted(parent)).toEqual([
        [
          {
            type: 'twake-embed:path',
            resourceId: 'p1',
            path: '',
            replace: true
          },
          HOST
        ]
      ])
    })

    it('reports the URL again to a new document greeted again', () => {
      // The frame reloaded (the silent login): the host greets the new
      // document, from the same origin
      fromHost(parent, hello)
      expect(posted(parent)).toHaveLength(1)

      fromHost(parent, hello, 'https://moved.test')
      expect(posted(parent).at(-1)).toEqual([
        { type: 'twake-embed:path', resourceId: 'p1', path: '', replace: true },
        'https://moved.test'
      ])
    })

    it('turns a push into a replace and reports it', () => {
      const length = window.history.length

      window.history.pushState(null, '', '/embed/projects/p1/boards/b2?x=1#y')

      expect(window.history.length).toBe(length)
      expect(window.location.pathname).toBe('/embed/projects/p1/boards/b2')
      expect(posted(parent).at(-1)).toEqual([
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/boards/b2?x=1#y',
          replace: false
        },
        HOST
      ])
    })

    it('reports a replace as one, and nothing off the route', () => {
      window.history.replaceState(null, '', '/embed/projects/p1/inbox')
      expect(posted(parent).at(-1)).toEqual([
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/inbox',
          replace: true
        },
        HOST
      ])
      const before = posted(parent).length
      window.history.replaceState(null, '', '/auth/callback?code=1')
      expect(posted(parent)).toHaveLength(before)
    })

    it('applies a navigate within the resource, without reporting its URL', async () => {
      handlers.onNavigate.mockImplementation(async (_id, path) => {
        await Promise.resolve()
        window.history.replaceState(null, '', `/embed/projects/p1${path}`)
      })
      const before = posted(parent).length

      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '/boards/b3'
      })
      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/embed/projects/p1/boards/b3')
      })

      expect(handlers.onNavigate).toHaveBeenCalledWith('p1', '/boards/b3')
      expect(posted(parent)).toHaveLength(before)
      window.history.replaceState(null, '', '/embed/projects/p1/boards/b4')
      expect(posted(parent)).toHaveLength(before + 1)
    })

    it('applies a load for another resource', () => {
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: '/boards/b1'
      })
      expect(handlers.onLoad).toHaveBeenCalledWith('p2', '/boards/b1')
    })

    it('drops a navigate for another resource, and anything unsafe or foreign', () => {
      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p2',
        path: '/boards/b3'
      })
      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '/../p2'
      })
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: '/%2e%2e/x'
      })
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: '//x'
      })
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'twake-embed:load', resourceId: 'p2', path: '' },
          origin: HOST,
          source: window
        })
      )

      expect(handlers.onNavigate).not.toHaveBeenCalled()
      expect(handlers.onLoad).not.toHaveBeenCalled()
    })

    it('syncs once, and stops for good', () => {
      if (!space) throw new Error('not connected')
      expect(space.syncHistory(handlers)).toBe(stop)
      const reported = posted(parent).length

      space.disconnect()
      window.history.pushState(null, '', '/embed/projects/p1/boards/b9')
      fromHost(parent, { type: 'twake-embed:load', resourceId: 'p3', path: '' })

      expect(posted(parent)).toHaveLength(reported)
      expect(handlers.onLoad).not.toHaveBeenCalled()
      expect(Object.hasOwn(window.history, 'pushState')).toBe(false)
      expect(Object.hasOwn(window.history, 'replaceState')).toBe(false)
    })
  })

  it('holds on the callback of the login, and reports once back on the route', () => {
    const parent = fakeParent()
    space = connect(parent, '/callback?code=1&state=s')
    if (!space) throw new Error('not connected')
    expect(space.location()).toBeNull()
    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    fromHost(parent, hello)
    expect(posted(parent)).toEqual([])

    window.history.replaceState(null, '', '/embed/projects/p1/inbox')

    expect(posted(parent)).toEqual([
      [
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/inbox',
          replace: true
        },
        HOST
      ]
    ])
  })

  it('reads the route from the hash for a hash router', () => {
    const parent = fakeParent()
    window.history.replaceState(null, '', '/#/embed/projects/p1')
    space = connectToTwakeSpace({
      embedPrefix: PREFIX,
      parent,
      hashRouting: true
    })
    if (!space) throw new Error('not connected')
    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    fromHost(parent, hello)

    window.history.pushState(null, '', '/#/embed/projects/p1/boards/b2?x=1')

    expect(space.location()).toEqual({
      resourceId: 'p1',
      path: '/boards/b2?x=1'
    })
    expect(posted(parent)).toEqual([
      [
        { type: 'twake-embed:path', resourceId: 'p1', path: '', replace: true },
        HOST
      ],
      [
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/boards/b2?x=1',
          replace: false
        },
        HOST
      ]
    ])
  })

  it('checks the resource id the app way', () => {
    const parent = fakeParent()
    window.history.replaceState(null, '', '/embed/projects/p1')
    space = connectToTwakeSpace({
      embedPrefix: PREFIX,
      parent,
      isResourceId: id => /^p\d+$/.test(id)
    })
    if (!space) throw new Error('not connected')
    const onLoad = vi.fn()
    space.syncHistory({ onLoad, onNavigate: vi.fn() })

    fromHost(parent, { type: 'twake-embed:load', resourceId: '../x', path: '' })
    fromHost(parent, { type: 'twake-embed:load', resourceId: 'p7', path: '' })

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith('p7', '')
  })
})

describe('links leaving the frame', () => {
  let space: TwakeSpaceConnection | null = null
  let navigation: EventTarget
  let open: Mock
  // Whether a click got past the guard with its default left
  let passedGuard: boolean[]
  const keepJsdomInPlace = (event: Event): void => {
    passedGuard.push(!event.defaultPrevented)
    event.preventDefault()
  }

  beforeEach(() => {
    navigation = new EventTarget()
    open = vi.fn()
    vi.stubGlobal('open', open)
    passedGuard = []
  })
  afterEach(() => {
    space?.disconnect()
    space = null
    vi.unstubAllGlobals()
    window.removeEventListener('click', keepJsdomInPlace)
    document.body.replaceChildren()
  })

  function sync(pathname: string, hashRouting = false): void {
    window.history.replaceState(null, '', pathname)
    space = connectToTwakeSpace({
      embedPrefix: PREFIX,
      parent: fakeParent(),
      navigation,
      hashRouting
    })
    space?.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    // After the guard's listener
    window.addEventListener('click', keepJsdomInPlace)
  }

  function click(href: string, attributes: Record<string, string> = {}): void {
    const link = document.createElement('a')
    link.href = href
    for (const [name, value] of Object.entries(attributes))
      link.setAttribute(name, value)
    document.body.append(link)
    link.click()
  }

  function navigate(
    url: string,
    init: { navigationType?: string; downloadRequest?: string } = {}
  ): Event {
    const event = Object.assign(new Event('navigate', { cancelable: true }), {
      navigationType: 'push',
      destination: { url: new URL(url, window.location.href).href },
      downloadRequest: null,
      formData: null,
      ...init
    })
    navigation.dispatchEvent(event)
    return event
  }

  it('leaves a link below the embed route to the app', () => {
    sync('/embed/projects/p1')
    click('/embed/projects/p1/boards/b1?task=T-1')
    click('#comments')
    expect(passedGuard).toEqual([true, true])
    expect(open).not.toHaveBeenCalled()
  })

  it('opens in a new tab a link to another origin, resource or page', () => {
    sync('/embed/projects/p1')
    click('https://notes.test/n/1')
    click('/embed/projects/p2')
    click('/settings')
    click('/embed/projects/p1//evil.test')
    expect(passedGuard).toEqual([false, false, false, false])
    expect(open.mock.calls).toEqual([
      ['https://notes.test/n/1', '_blank', 'noopener'],
      [
        new URL('/embed/projects/p2', window.location.href).href,
        '_blank',
        'noopener'
      ],
      [new URL('/settings', window.location.href).href, '_blank', 'noopener'],
      [
        new URL('/embed/projects/p1//evil.test', window.location.href).href,
        '_blank',
        'noopener'
      ]
    ])
  })

  it('leaves a new tab, a download or a modified click to the browser', () => {
    sync('/embed/projects/p1')
    click('https://notes.test/n/1', { target: '_blank' })
    click('https://notes.test/n/1', { download: '' })
    const link = document.createElement('a')
    link.href = 'https://notes.test/n/1'
    document.body.append(link)
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true
      })
    )
    expect(passedGuard).toEqual([true, true, true])
    expect(open).not.toHaveBeenCalled()
  })

  it('leaves to the app a link it handles itself', () => {
    sync('/embed/projects/p1')
    const select = (event: Event): void => {
      event.preventDefault()
    }
    document.addEventListener('click', select)
    click('https://notes.test/n/1')
    document.removeEventListener('click', select)
    expect(open).not.toHaveBeenCalled()
  })

  it('opens in a new tab any other navigation leaving the route', () => {
    sync('/embed/projects/p1')
    expect(navigate('/embed/projects/p1/inbox').defaultPrevented).toBe(false)
    expect(navigate('https://notes.test/n/1').defaultPrevented).toBe(true)
    expect(
      navigate('https://notes.test/n/1', { navigationType: 'reload' })
        .defaultPrevented
    ).toBe(false)
    expect(
      navigate('https://files.test/a.pdf', { downloadRequest: 'a.pdf' })
        .defaultPrevented
    ).toBe(false)
    expect(open.mock.calls).toEqual([
      ['https://notes.test/n/1', '_blank', 'noopener']
    ])
  })

  it('reads the route from the hash for a hash router', () => {
    sync('/#/embed/projects/p1', true)
    click('#/embed/projects/p1/folder/f1')
    click('#/note/n1')
    click('/intents#/embed/projects/p1')
    expect(passedGuard).toEqual([true, false, false])
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('lets TwakeSpace move the frame, and stops with the sync', async () => {
    window.history.replaceState(null, '', '/embed/projects/p1')
    const parent = fakeParent()
    space = connectToTwakeSpace({ embedPrefix: PREFIX, parent, navigation })
    if (!space) throw new Error('not connected')
    // Nothing guarded before the sync: the silent login redirects freely
    expect(navigate('https://sso.test/').defaultPrevented).toBe(false)

    const moved: Event[] = []
    const stop = space.syncHistory({
      onLoad: () => {
        moved.push(navigate('/embed/projects/p2'))
      },
      onNavigate: vi.fn()
    })
    fromHost(parent, { type: 'twake-embed:load', resourceId: 'p2', path: '' })
    await Promise.resolve()
    expect(moved.map(event => event.defaultPrevented)).toEqual([false])

    stop()
    expect(navigate('https://notes.test/n/1').defaultPrevented).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
