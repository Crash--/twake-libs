import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { connectToTwakeSpace, type TwakeSpaceConnection } from './app.js'

const PREFIX = '/embed/projects/'
const ROUTE = `${window.location.origin}/embed/projects/p1`

interface Nav extends EventTarget {
  fire: (init: Partial<NavInit>) => Event
}
interface NavInit {
  url: string
  sameDocument: boolean
  navigationType: string
  userInitiated: boolean
  downloadRequest: string | null
  formData: FormData | null
  cancelable: boolean
}

function mockNavigation(): Nav {
  const nav = new EventTarget() as Nav
  nav.fire = (init): Event => {
    const o = {
      url: `${window.location.origin}/elsewhere`,
      sameDocument: false,
      navigationType: 'push',
      userInitiated: true,
      downloadRequest: null,
      formData: null,
      cancelable: true,
      ...init
    }
    const event = new Event('navigate', { cancelable: o.cancelable })
    Object.assign(event, {
      destination: { url: o.url, sameDocument: o.sameDocument },
      navigationType: o.navigationType,
      userInitiated: o.userInitiated,
      downloadRequest: o.downloadRequest,
      formData: o.formData
    })
    nav.dispatchEvent(event)
    return event
  }
  return nav
}

function setActivation(isActive: boolean): void {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { isActive }
  })
}

function connect(
  options: { interceptExternalLinks?: boolean; hashRouting?: boolean } = {}
): TwakeSpaceConnection {
  window.history.replaceState(null, '', '/embed/projects/p1/inbox')
  const space = connectToTwakeSpace({
    embedPrefix: PREFIX,
    parent: { postMessage: vi.fn() } as unknown as Window,
    ...options
  })
  if (space === null) throw new Error('not framed')
  return space
}

describe('links leaving the frame', () => {
  let space: TwakeSpaceConnection | null = null
  let open: ReturnType<typeof vi.fn>
  afterEach(() => {
    space?.disconnect()
    space = null
    Reflect.deleteProperty(window, 'navigation')
    Reflect.deleteProperty(navigator, 'userActivation')
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    // jsdom reports the navigations it does not implement
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    open = vi.fn()
    window.open = open as unknown as typeof window.open
  })

  describe('with the Navigation API', () => {
    let nav: Nav
    beforeEach(() => {
      nav = mockNavigation()
      Object.defineProperty(window, 'navigation', {
        configurable: true,
        value: nav
      })
      setActivation(false)
      space = connect()
    })

    it('keeps a destination below the embed route in the frame', () => {
      const event = nav.fire({ url: `${ROUTE}/sent?q=1#top` })
      expect(event.defaultPrevented).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('opens another route of the same origin in a new tab', () => {
      for (const path of [
        '/embed/projects/p2',
        '/embed/projects/p10',
        '/settings'
      ]) {
        const url = window.location.origin + path
        expect(nav.fire({ url }).defaultPrevented).toBe(true)
        expect(open).toHaveBeenLastCalledWith(
          new URL(url),
          '_blank',
          'noopener,noreferrer'
        )
      }
    })

    it('opens another origin in a new tab', () => {
      const url = 'https://example.org/page'
      expect(nav.fire({ url }).defaultPrevented).toBe(true)
      expect(open).toHaveBeenCalledWith(
        new URL(url),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('guards the clicks too, since some browsers never fire navigate for them', () => {
      setActivation(true)
      document.body.innerHTML = '<a href="https://example.org/">x</a>'
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      document.querySelector('a')?.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(open).toHaveBeenCalledOnce()
    })

    it('opens it for a script that runs on a user activation', () => {
      setActivation(true)
      const event = nav.fire({
        url: 'https://example.org/',
        userInitiated: false
      })
      expect(event.defaultPrevented).toBe(true)
    })

    it('leaves the silent login redirect alone (no activation)', () => {
      for (const navigationType of ['replace', 'push']) {
        const event = nav.fire({
          url: 'https://sso.example.org/oauth2/authorize?prompt=none',
          navigationType,
          userInitiated: false
        })
        expect(event.defaultPrevented).toBe(false)
      }
      expect(open).not.toHaveBeenCalled()
    })

    it('leaves a replace alone even on a user activation', () => {
      setActivation(true)
      const event = nav.fire({
        url: 'https://sso.example.org/',
        navigationType: 'replace'
      })
      expect(event.defaultPrevented).toBe(false)
    })

    it('leaves downloads, same-document and hash navigations alone', () => {
      const url = 'https://example.org/'
      expect(nav.fire({ url, downloadRequest: 'a.pdf' }).defaultPrevented).toBe(
        false
      )
      expect(nav.fire({ url, sameDocument: true }).defaultPrevented).toBe(false)
      expect(
        nav.fire({
          url: `${window.location.origin}/settings#x`,
          sameDocument: true
        }).defaultPrevented
      ).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('leaves traversals, uncancelable events and form posts alone', () => {
      const url = 'https://example.org/'
      expect(
        nav.fire({ url, navigationType: 'traverse' }).defaultPrevented
      ).toBe(false)
      expect(nav.fire({ url, cancelable: false }).defaultPrevented).toBe(false)
      expect(nav.fire({ url, formData: new FormData() }).defaultPrevented).toBe(
        false
      )
      expect(open).not.toHaveBeenCalled()
    })

    it('leaves schemes other than http(s) alone', () => {
      expect(nav.fire({ url: 'mailto:a@b.c' }).defaultPrevented).toBe(false)
    })

    it('off the embed route, only another origin leaves it', () => {
      window.history.replaceState(null, '', '/oidc/callback')
      setActivation(true)
      expect(
        nav.fire({ url: `${window.location.origin}/x` }).defaultPrevented
      ).toBe(false)
      expect(nav.fire({ url: 'https://example.org/' }).defaultPrevented).toBe(
        true
      )
      setActivation(false)
      expect(
        nav.fire({
          url: 'https://sso.example.org/',
          navigationType: 'replace',
          userInitiated: false
        }).defaultPrevented
      ).toBe(false)
    })

    it('does nothing once disconnected', () => {
      space?.disconnect()
      expect(nav.fire({ url: 'https://example.org/' }).defaultPrevented).toBe(
        false
      )
    })

    it('leaves a navigation another connection already cancelled', () => {
      const other = connect()
      expect(nav.fire({ url: 'https://example.org/' }).defaultPrevented).toBe(
        true
      )
      expect(open).toHaveBeenCalledOnce()
      other.disconnect()
    })

    it('does nothing when the app turns it off', () => {
      space?.disconnect()
      space = connect({ interceptExternalLinks: false })
      expect(nav.fire({ url: 'https://example.org/' }).defaultPrevented).toBe(
        false
      )
    })
  })

  describe('with a hash router', () => {
    it('reads the route in the fragment, and keeps a fragment link in the frame', () => {
      setActivation(true)
      window.history.replaceState(null, '', '/#/embed/projects/p1/inbox')
      space = connectToTwakeSpace({
        embedPrefix: PREFIX,
        hashRouting: true,
        parent: { postMessage: vi.fn() } as unknown as Window
      })
      const origin = window.location.origin
      const click = (href: string): boolean => {
        document.body.innerHTML = `<a href="${href}">x</a>`
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true
        })
        document.querySelector('a')?.dispatchEvent(event)
        return event.defaultPrevented
      }
      expect(click('#top')).toBe(false)
      expect(click('#/settings')).toBe(false)
      expect(click(`${origin}/#/embed/projects/p1/sent`)).toBe(false)
      expect(click(`${origin}/#/embed/projects/p2`)).toBe(false)
      expect(click(`${origin}/other#/embed/projects/p1`)).toBe(true)
    })
  })

  describe('click and submit guards', () => {
    beforeEach(() => {
      space = connect()
    })

    function click(html: string, init: MouseEventInit = {}): MouseEvent {
      document.body.innerHTML = html
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init
      })
      // jsdom does not navigate
      document.body.querySelector('a, area')?.dispatchEvent(event)
      return event
    }

    it('opens a link to another origin or route in a new tab', () => {
      expect(
        click('<a href="https://example.org/x">x</a>').defaultPrevented
      ).toBe(true)
      expect(open).toHaveBeenCalledWith(
        new URL('https://example.org/x'),
        '_blank',
        'noopener,noreferrer'
      )
      expect(click('<a href="/settings">x</a>').defaultPrevented).toBe(true)
    })

    it('opens a click on an element inside the link', () => {
      document.body.innerHTML = '<a href="https://example.org/"><b>x</b></a>'
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      document.querySelector('b')?.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('keeps a link below the route in the frame', () => {
      expect(
        click('<a href="/embed/projects/p1/sent">x</a>').defaultPrevented
      ).toBe(false)
      expect(click('<a href="#top">x</a>').defaultPrevented).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('leaves to the browser what is not a plain click', () => {
      const href = 'href="https://example.org/"'
      expect(
        click(`<a ${href}>x</a>`, { ctrlKey: true }).defaultPrevented
      ).toBe(false)
      expect(
        click(`<a ${href}>x</a>`, { shiftKey: true }).defaultPrevented
      ).toBe(false)
      expect(click(`<a ${href}>x</a>`, { button: 1 }).defaultPrevented).toBe(
        false
      )
      expect(click(`<a ${href} download>x</a>`).defaultPrevented).toBe(false)
      expect(click(`<a ${href} target="_blank">x</a>`).defaultPrevented).toBe(
        false
      )
      setActivation(false)
      expect(click(`<a ${href}>x</a>`).defaultPrevented).toBe(false)
      expect(click('<a href="mailto:a@b.c">x</a>').defaultPrevented).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('opens another origin even when a handler stops the click', () => {
      document.body.innerHTML =
        '<div id="root"><a id="e" href="https://example.org/">x</a><a id="s" href="/settings">y</a></div>'
      document
        .getElementById('root')
        ?.addEventListener('click', e => e.stopPropagation())
      const go = (id: string): boolean => {
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true
        })
        document.getElementById(id)?.dispatchEvent(event)
        return event.defaultPrevented
      }
      expect(go('e')).toBe(true)
      expect(go('s')).toBe(false)
    })

    it('ignores an href that does not parse', () => {
      expect(click('<a href="http://[bad">x</a>').defaultPrevented).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('finds the link through a shadow root', () => {
      document.body.innerHTML = '<div id="host"></div>'
      const root = (
        document.getElementById('host') as HTMLElement
      ).attachShadow({ mode: 'open' })
      root.innerHTML = '<a href="https://example.org/"><b>x</b></a>'
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true
      })
      root.querySelector('b')?.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('leaves a click the app handled to the app', () => {
      document.body.innerHTML = '<a href="/settings">x</a>'
      const link = document.querySelector('a') as HTMLAnchorElement
      link.addEventListener('click', e => e.preventDefault())
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      link.dispatchEvent(event)
      expect(open).not.toHaveBeenCalled()
    })

    function submit(html: string): Event {
      document.body.innerHTML = html
      const event = new Event('submit', { bubbles: true, cancelable: true })
      document.querySelector('form')?.dispatchEvent(event)
      return event
    }

    it('opens a GET form to another origin in a new tab, with its fields', () => {
      const event = submit(
        '<form action="https://example.org/search"><input name="q" value="a b"></form>'
      )
      expect(event.defaultPrevented).toBe(true)
      expect(open).toHaveBeenCalledWith(
        new URL('https://example.org/search?q=a+b'),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('reads the formaction and formmethod of the button that submits', () => {
      document.body.innerHTML =
        '<form action="/embed/projects/p1/s"><button id="a" formaction="https://example.org/x">a</button>' +
        '<button id="b" formaction="https://example.org/y" formmethod="post">b</button></form>'
      const form = document.querySelector('form') as HTMLFormElement
      const send = (id: string): Event => {
        const event = new SubmitEvent('submit', {
          bubbles: true,
          cancelable: true,
          submitter: document.getElementById(id)
        })
        form.dispatchEvent(event)
        return event
      }
      expect(send('a').defaultPrevented).toBe(true)
      expect(open).toHaveBeenCalledWith(
        new URL('https://example.org/x'),
        '_blank',
        'noopener,noreferrer'
      )
      expect(send('b').defaultPrevented).toBe(false)
    })

    it('reads an invalid formmethod as the method of the form', () => {
      document.body.innerHTML =
        '<form action="https://example.org/x"><button formmethod="nope">a</button></form>'
      const event = new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
        submitter: document.querySelector('button')
      })
      document.querySelector('form')?.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('leaves a post, a form below the route and a form with a target alone', () => {
      expect(
        submit('<form method="post" action="https://example.org/"></form>')
          .defaultPrevented
      ).toBe(false)
      expect(
        submit('<form action="/embed/projects/p1/search"></form>')
          .defaultPrevented
      ).toBe(false)
      expect(
        submit('<form target="_blank" action="https://example.org/"></form>')
          .defaultPrevented
      ).toBe(false)
      expect(open).not.toHaveBeenCalled()
    })

    it('stops guarding once disconnected', () => {
      space?.disconnect()
      expect(
        click('<a href="https://example.org/">x</a>').defaultPrevented
      ).toBe(false)
    })
  })
})
