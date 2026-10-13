// The app side of the contract: what an app framed by TwakeSpace does.
//
// The page and its frames share one browser history, and TwakeSpace owns it:
// in a frame the app never adds an entry and never navigates its own
// document after its boot. `syncHistory` turns `pushState` into
// `replaceState`, reports every change of the frame's URL, and applies the
// `load` and `navigate` messages of TwakeSpace. Measured in Chromium, Firefox
// and WebKit: a removed frame keeps its entries as dead Back presses in
// Chromium and WebKit, and a frame that only replaces adds none.
//
// The app does not need to know where TwakeSpace is: TwakeSpace greets the
// frame (`twake-embed:hello`) on each of its loads and whenever the app says
// it is listening (`twake-embed:ready`, since the app may boot after the
// frame's load), and the app answers the origin that greeted it. Only a page the app's `frame-ancestors` allows can
// be that parent, so the parent is trusted by construction: the header stays
// mandatory. `hostOrigins` restricts the hosts further, when given.
import { guardLinks } from './links.js'
import {
  badgesMessage,
  metadataMessage,
  notificationCloseMessage,
  notificationMessage,
  fillPageMessage,
  loginRequiredMessage,
  overlayRegionMessage,
  parseHostMessage,
  pathMessage,
  pipMessage,
  readyMessage,
  type AppMessage,
  type Badge,
  type Metadata,
  type OverlayRegion
} from './messages.js'
import {
  embedRoute,
  isBelow,
  parseEmbedUrl,
  staysBelow,
  type EmbedLocation
} from './paths.js'

export interface TwakeSpaceOptions {
  /** The embed route without the resource id, '/embed/projects/' */
  embedPrefix: string
  /**
   * The origins of TwakeSpace the app accepts, when it wants to restrict
   * them. Without it, the app talks to the page that framed it, once that
   * page greeted it.
   */
  hostOrigins?: readonly string[] | undefined
  /** The shape of a resource id of this app, when it has one */
  isResourceId?: ((resourceId: string) => boolean) | undefined
  /**
   * The app routes in the fragment, as a hash router does
   * (`/#/embed/projects/p1`): the embed route is read from the hash, and
   * TwakeSpace frames `/#<prefix><resource id>`.
   */
  hashRouting?: boolean | undefined
  /** The frame's parent, for tests */
  parent?: Window | undefined
  /** The Navigation API, for tests */
  navigation?: EventTarget | undefined
}

export interface HistoryHandlers {
  /**
   * Show another resource at `path`, with a replace: the app resets what is
   * keyed by the resource. An app that cannot yet does
   * `location.replace(embedRoute(prefix, resourceId) + path)`. Nothing the
   * handler writes to the URL is reported while its promise is pending.
   */
  onLoad: (resourceId: string, path: string) => void | Promise<void>
  /** Show `path` within the resource shown, with a replace */
  onNavigate: (resourceId: string, path: string) => void | Promise<void>
}

export interface TwakeSpaceConnection {
  /** The resource and path of the frame's URL, null off the embed route */
  location: () => EmbedLocation | null
  /** The origin of the host, once it greeted the frame */
  hostOrigin: () => string | null
  /** The silent login was refused: TwakeSpace signs the user in again */
  notifyLoginRequired: () => void
  /** Where the app draws on its overlay (the overlay itself is twake-mui's) */
  reportOverlayRegion: (region: OverlayRegion) => void
  /**
   * Asks TwakeSpace for its whole page (a call), or gives it back. Only the
   * apps TwakeSpace allows it to get it. Not the browser's full screen.
   */
  fillPage: (fill: boolean) => void
  /**
   * The counts of the app for every resource it knows, shown on the tabs of
   * TwakeSpace: each call replaces the previous counts. The last ones are
   * sent again to a host that greets the frame later.
   */
  reportBadges: (badges: readonly Badge[]) => void
  /**
   * The metadata of the app for every resource it knows, its tab counts
   * (`badge`) included, shown on the tabs and the home of each space: each
   * call replaces the previous metadata. The last ones are sent again to a
   * host that greets the frame later.
   */
  reportMetadata: (metadata: readonly Metadata[]) => void
  /**
   * A notification of the system, shown by TwakeSpace: a frame of another
   * origin may not show one. A new one with the same `tag` replaces it.
   * `resourceId`: the resource it is about, whose space TwakeSpace opens
   * on a click. Not sent again to a host that greets later: it is of the
   * moment.
   */
  notify: (notice: {
    tag: string
    title: string
    body: string
    resourceId?: string
  }) => void
  /** Closes the notification of that tag, when what it told is over */
  closeNotification: (tag: string) => void
  /**
   * Asks TwakeSpace to open a call at `url` in its call window, floating
   * over its page. TwakeSpace opens the rooms of its Meet only.
   */
  openPip: (url: string) => void
  /**
   * Leaves the history to TwakeSpace, from now on: a push becomes a replace,
   * every change of the URL is reported (the current one first, as a
   * replace, once the host is known), and `load` and `navigate` are applied
   * through the handlers. A link or a navigation leaving the embed route
   * shown opens in a new tab. Once: a second call returns the same stop
   * function.
   */
  syncHistory: (handlers: HistoryHandlers) => () => void
  /** Stops the history sync and forgets the host */
  disconnect: () => void
}

/**
 * The connection to TwakeSpace, null when the app is not framed: the app
 * then runs on its own. Off the embed route (the callback of the silent
 * login, where a framed app may boot) the connection holds: nothing is
 * reported until the URL is back on the route.
 */
export function connectToTwakeSpace(
  options: TwakeSpaceOptions
): TwakeSpaceConnection | null {
  const {
    embedPrefix,
    hostOrigins,
    isResourceId = (): boolean => true,
    hashRouting = false
  } = options
  const parent = options.parent ?? window.parent
  if (parent === window) return null
  if (hostOrigins !== undefined && hostOrigins.length === 0) return null

  const locate = ({
    pathname,
    search,
    hash
  }: URL | Location): EmbedLocation | null => {
    if (hashRouting) {
      // Split as a hash router does: its pathname ends at the first ? or #
      const route = hash.slice(1)
      const end = route.search(/[?#]/)
      const routePath = end === -1 ? route : route.slice(0, end)
      return parseEmbedUrl(
        embedPrefix,
        routePath,
        route.slice(routePath.length)
      )
    }
    return parseEmbedUrl(embedPrefix, pathname, search, hash)
  }
  const location = (): EmbedLocation | null => locate(window.location)

  // Known once the host spoke, or given
  let origin: string | null = null
  const post = (message: AppMessage): void => {
    if (origin !== null) parent.postMessage(message, origin)
  }

  // Sent again to a host learnt later: the app reports them on change only
  let badges: readonly Badge[] | null = null
  let metadata: readonly Metadata[] | null = null

  let handlers: HistoryHandlers | null = null
  let stop: (() => void) | null = null
  let suppressed = 0
  const reportCurrent = (replace: boolean): void => {
    if (suppressed > 0 || handlers === null) return
    const here = location()
    if (here !== null) post(pathMessage(here.resourceId, here.path, replace))
  }
  // Nothing written while a handler runs is reported: TwakeSpace asked for
  // it. A router writes the URL once its navigation settles, hence the await.
  const apply = async (handler: () => void | Promise<void>): Promise<void> => {
    suppressed += 1
    try {
      await handler()
    } finally {
      suppressed -= 1
    }
  }

  // Below the embed route shown, on this origin. Anything goes while
  // TwakeSpace moves the frame, and off the route (the silent login).
  const staysInFrame = (url: URL): boolean => {
    const here = location()
    if (suppressed > 0 || here === null) return true
    const { origin: frameOrigin, pathname, search } = window.location
    if (url.origin !== frameOrigin) return false
    // With a hash router, another document of the origin is another page
    if (hashRouting && (url.pathname !== pathname || url.search !== search))
      return false
    const there = locate(url)
    return there?.resourceId === here.resourceId && isBelow(there.path)
  }

  // Every message of the parent tells where the host is; the first one, or
  // the first one of a new document of the frame, is answered with the path.
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== parent) return
    if (hostOrigins !== undefined && !hostOrigins.includes(event.origin)) return
    const message = parseHostMessage(event.data)
    if (message === null) return
    if (origin !== event.origin) {
      origin = event.origin
      reportCurrent(true)
      if (badges !== null) post(badgesMessage(badges))
      if (metadata !== null) post(metadataMessage(metadata))
    }
    if (message.type === 'twake-embed:hello') return
    const { resourceId, path } = message
    if (handlers === null || !isResourceId(resourceId)) return
    if (!staysBelow(embedRoute(embedPrefix, resourceId), path)) return
    const current = handlers
    if (message.type === 'twake-embed:navigate') {
      if (location()?.resourceId !== resourceId) return
      void apply(() => current.onNavigate(resourceId, path))
    } else {
      void apply(() => current.onLoad(resourceId, path))
    }
  }
  window.addEventListener('message', onMessage)
  // The frame may have loaded before the app listened: it asks for the
  // greeting. The message carries nothing, so any parent may read it.
  const askForGreeting = (): void => {
    if (origin === null) parent.postMessage(readyMessage(), '*')
  }
  askForGreeting()

  const syncHistory = (next: HistoryHandlers): (() => void) => {
    if (stop !== null) return stop
    handlers = next
    const { history } = window
    // Called back on `history`, restored as they were
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { pushState, replaceState } = history
    const owned = {
      pushState: Object.hasOwn(history, 'pushState'),
      replaceState: Object.hasOwn(history, 'replaceState')
    }
    history.pushState = function (...args): void {
      replaceState.apply(history, args)
      reportCurrent(false)
    }
    history.replaceState = function (...args): void {
      replaceState.apply(history, args)
      reportCurrent(true)
    }

    // After the boot, so the silent login's redirects went through
    const unguard = guardLinks(staysInFrame, options.navigation)

    // The first URL came from no history call
    reportCurrent(true)
    askForGreeting()

    stop = (): void => {
      unguard()
      // Own properties shadow the ones of History: dropping them restores it
      if (owned.pushState) history.pushState = pushState
      else Reflect.deleteProperty(history, 'pushState')
      if (owned.replaceState) history.replaceState = replaceState
      else Reflect.deleteProperty(history, 'replaceState')
      handlers = null
      stop = null
    }
    return stop
  }

  return {
    location,
    hostOrigin: () => origin,
    notifyLoginRequired: (): void => {
      post(loginRequiredMessage())
    },
    reportOverlayRegion: (region): void => {
      post(overlayRegionMessage(region))
    },
    fillPage: (fill): void => {
      post(fillPageMessage(fill))
    },
    reportBadges: (next): void => {
      badges = next
      post(badgesMessage(next))
    },
    reportMetadata: (next): void => {
      metadata = next
      post(metadataMessage(next))
    },
    notify: (notice): void => {
      post(notificationMessage(notice))
    },
    closeNotification: (tag): void => {
      post(notificationCloseMessage(tag))
    },
    openPip: (url): void => {
      post(pipMessage(url))
    },
    syncHistory,
    disconnect: (): void => {
      stop?.()
      window.removeEventListener('message', onMessage)
      origin = null
    }
  }
}
