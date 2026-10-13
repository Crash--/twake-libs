// Links leaving the frame: a navigation that stays below the embed route the
// frame shows runs in the frame, any other opens in a new tab. TwakeSpace
// can neither see nor cancel a navigation of its cross-origin frame, so the
// frame does it, with two guards testing the same thing:
// - a Navigation API hook, which sees every navigation with its URL: link
//   clicks, forms, `location.assign`, the router's writes,
// - a click guard, for a link the app leaves to the browser, the only guard
//   where the API is missing (Safari before 26). It runs after the app, not
//   in the capture phase: Drive's rows are links it cancels to select a file
//   on a click and open it on a double click, then the hook sees the opening.
// The new tab is opened by the frame, so TwakeSpace's sandbox needs
// `allow-popups-to-escape-sandbox`, or the tab inherits it and cannot sign in.

// The part of the Navigation API used here, not in the DOM types yet
interface NavigateEvent extends Event {
  readonly navigationType: 'push' | 'replace' | 'reload' | 'traverse'
  readonly destination: { readonly url: string }
  readonly downloadRequest: string | null
  readonly formData: FormData | null
}

const openInNewTab = (url: URL): void => {
  window.open(url.href, '_blank', 'noopener')
}

/**
 * Opens in a new tab every navigation of the frame to a URL `staysInFrame`
 * refuses. `navigation`: the Navigation API, for tests. Returns the stop.
 */
export function guardLinks(
  staysInFrame: (url: URL) => boolean,
  navigation: EventTarget | undefined = (window as { navigation?: EventTarget })
    .navigation
): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return
    // The browser opens these in a new tab or saves them already
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement | HTMLAreaElement =>
          node instanceof HTMLAnchorElement || node instanceof HTMLAreaElement
      )
    if (link === undefined || link.href === '' || link.hasAttribute('download'))
      return
    if (link.target !== '' && link.target !== '_self') return
    const url = new URL(link.href)
    if (staysInFrame(url)) return
    event.preventDefault()
    openInNewTab(url)
  }

  const onNavigate = (event: Event): void => {
    const { navigationType, destination, downloadRequest, formData } =
      event as NavigateEvent
    if (navigationType !== 'push' && navigationType !== 'replace') return
    // ponytail: a POST form leaving the frame is let through, a new tab
    // cannot replay its body; frame-src stays the backstop
    if (!event.cancelable || downloadRequest !== null || formData !== null)
      return
    const url = new URL(destination.url)
    if (staysInFrame(url)) return
    event.preventDefault()
    openInNewTab(url)
  }

  // On window, so it runs after the listeners of the app's root
  window.addEventListener('click', onClick)
  navigation?.addEventListener('navigate', onNavigate)
  return (): void => {
    window.removeEventListener('click', onClick)
    navigation?.removeEventListener('navigate', onNavigate)
  }
}
