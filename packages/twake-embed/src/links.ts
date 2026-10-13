// Links leaving the frame open in a new tab, as a webview decides in its
// "should start load". A navigation the user caused (a click, a form, a
// script running on a click) to an http(s) page that is not below the embed
// route is cancelled and opened with `window.open`. Left alone:
// - same-document navigations (pushState, fragments), downloads, traversals;
// - anything that is not a push: the silent login and the OIDC renewals do a
//   `location.replace` at boot, with no user activation, to the SSO;
// - form posts: a new tab cannot carry the body, and cancelling would lose
//   it. The `frame-src` of TwakeSpace is the backstop for those.
// A click and a submit guard apply the same rule to links and forms, in the
// bubble phase so that a link the app handles itself (`preventDefault`) is
// not opened as well; links to another origin are also caught in the capture
// phase, since a handler that stops the click would hide them. They are not only for browsers without the Navigation
// API: Firefox and WebKit check the `frame-src` of the host before they fire
// `navigate`, so a link to another origin never reaches that event there.

interface NavigateEvent extends Event {
  readonly destination: {
    readonly url: string
    readonly sameDocument: boolean
  }
  readonly navigationType: 'push' | 'replace' | 'reload' | 'traverse'
  readonly userInitiated: boolean
  readonly downloadRequest: string | null
  readonly formData: FormData | null
}

type NavigationTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>

const isWeb = (url: URL): boolean => /^https?:$/.test(url.protocol)

function parse(href: string): URL | null {
  try {
    return new URL(href, document.baseURI)
  } catch {
    return null
  }
}

const withoutHash = (url: URL | Location): string =>
  url.href.split('#', 1)[0] ?? ''

// A link to a fragment of this very document stays in the frame (a hash router)
const isSamePage = (url: URL): boolean =>
  url.hash !== '' && withoutHash(url) === withoutHash(window.location)

function openAside(url: URL): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Stops the guard. `leaves` tells whether a destination is out of the route. */
export function guardLinks(leaves: (url: URL) => boolean): () => void {
  const navigation = (window as { navigation?: NavigationTarget }).navigation

  const stops: (() => void)[] = []

  if (navigation !== undefined) {
    const onNavigate = (event: Event): void => {
      const nav = event as NavigateEvent
      if (nav.defaultPrevented || !nav.cancelable) return
      if (nav.destination.sameDocument) return
      if (nav.navigationType !== 'push' || nav.downloadRequest !== null) return
      if (nav.formData !== null) return
      if (!nav.userInitiated && navigator.userActivation?.isActive !== true) {
        return
      }
      const url = parse(nav.destination.url)
      if (url === null || !isWeb(url) || !leaves(url)) return
      nav.preventDefault()
      openAside(url)
    }
    navigation.addEventListener('navigate', onNavigate)
    stops.push(() => {
      navigation.removeEventListener('navigate', onNavigate)
    })
  }

  const plain = (event: Event, target: string | null): boolean =>
    navigator.userActivation?.isActive !== false &&
    !event.defaultPrevented &&
    ['', '_self'].includes(target ?? '')

  // `capture`: before the handlers of the app, which may stop the click (a
  // React component) and hide it from the bubble phase. Only for another
  // origin, which no router handles; a same-origin link the app handles
  // itself (`preventDefault`) is left to the bubble phase.
  const onClick =
    (capture: boolean) =>
    (event: MouseEvent): void => {
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const link = event
        .composedPath()
        .find(
          (node): node is Element =>
            node instanceof Element && node.matches('a[href], area[href]')
        )
      if (!link || link.hasAttribute('download')) return
      if (!plain(event, link.getAttribute('target'))) return
      const url = parse(link.getAttribute('href') ?? '')
      if (url === null || !isWeb(url) || isSamePage(url) || !leaves(url)) return
      if (capture && url.origin === window.location.origin) return
      event.preventDefault()
      openAside(url)
    }

  const onSubmit = (event: SubmitEvent): void => {
    const form = event.target as HTMLFormElement
    const submitter = event.submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null
    // The attributes, not `submitter.formAction` and the like: Firefox and
    // WebKit answer the page's own URL when the button has no `formaction`
    const attr = (name: string): string | null =>
      submitter?.getAttribute(`form${name}`) ?? form.getAttribute(name)
    const given = (submitter?.getAttribute('formmethod') ?? '').toLowerCase()
    // An invalid value is read as the form's own method, which maps it to get
    const method = ['get', 'post', 'dialog'].includes(given)
      ? given
      : form.method
    if (method !== 'get') return
    if (!plain(event, attr('target'))) return
    const url = parse(attr('action') ?? '')
    if (url === null || !isWeb(url) || isSamePage(url) || !leaves(url)) return
    const fields = new FormData(form, submitter)
    url.search = new URLSearchParams(
      fields as unknown as Record<string, string>
    ).toString()
    event.preventDefault()
    openAside(url)
  }

  const bubble = onClick(false)
  const capture = onClick(true)
  document.addEventListener('click', bubble)
  document.addEventListener('submit', onSubmit)
  window.addEventListener('click', capture, true)
  stops.push(() => {
    document.removeEventListener('click', bubble)
    document.removeEventListener('submit', onSubmit)
    window.removeEventListener('click', capture, true)
  })
  return (): void => {
    for (const stop of stops) stop()
  }
}
