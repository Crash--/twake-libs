// The messages between TwakeSpace and a framed app, as `postMessage` data.
// Both sides check the origin and the source of what they receive, and parse
// it with the functions below: a message that does not fit is dropped.
import { isBelow } from './paths.js'

export const PATH_MESSAGE = 'twake-embed:path'
export const LOAD_MESSAGE = 'twake-embed:load'
export const NAVIGATE_MESSAGE = 'twake-embed:navigate'
export const LOGIN_REQUIRED_MESSAGE = 'twake-embed:login-required'
export const OVERLAY_REGION_MESSAGE = 'twake-embed:overlay-region'
export const FILL_PAGE_MESSAGE = 'twake-embed:fill-page'
export const HELLO_MESSAGE = 'twake-embed:hello'
export const READY_MESSAGE = 'twake-embed:ready'
export const BADGES_MESSAGE = 'twake-embed:badges'
export const METADATA_MESSAGE = 'twake-embed:metadata'
export const NOTIFICATION_MESSAGE = 'twake-embed:notification'
export const NOTIFICATION_CLOSE_MESSAGE = 'twake-embed:notification-close'
export const PIP_MESSAGE = 'twake-embed:pip'
export const UPLOAD_MESSAGE = 'twake-embed:upload'
export const UPLOAD_DONE_MESSAGE = 'twake-embed:upload-done'

/**
 * The URL of the frame changed. `replace` is true when the app replaced its
 * URL (a redirect, a query, the URL written while applying a `load` or a
 * `navigate`), false when the user moved: TwakeSpace then adds an entry.
 */
export interface PathMessage {
  type: typeof PATH_MESSAGE
  resourceId: string
  path: string
  replace: boolean
}

/**
 * The app is listening: TwakeSpace answers with its greeting. The app says
 * it to whoever framed it (an empty message, to any origin), since it does
 * not know its host yet; only a page its `frame-ancestors` allows can be
 * there.
 */
export interface ReadyMessage {
  type: typeof READY_MESSAGE
}

/** The silent login was refused: TwakeSpace signs the user in again */
export interface LoginRequiredMessage {
  type: typeof LOGIN_REQUIRED_MESSAGE
}

/** Where the app draws on its overlay: TwakeSpace shows that part only */
export interface OverlayRegionMessage {
  type: typeof OVERLAY_REGION_MESSAGE
  region: OverlayRegion
}

/**
 * The app needs the whole page of TwakeSpace, or gives it back: a call in
 * Chat. TwakeSpace lets the frame cover its page while `fill` is true, for
 * the apps it allows it to. Not the browser's full screen: that one an app
 * asks the browser for itself, with `requestFullscreen`.
 */
export interface FillPageMessage {
  type: typeof FILL_PAGE_MESSAGE
  fill: boolean
}

/** What the app counts for one of its resources: unread mail, notifications */
export interface Badge {
  resourceId: string
  count: number
}

/**
 * The counts of the app for every resource it knows, shown or not: one frame
 * of the app serves every space, so TwakeSpace keys them by resource, shows
 * them on the tab of each space and adds them up in its list of spaces. Each
 * message replaces the previous one; a count of 0, or a resource left out,
 * shows nothing.
 */
export interface BadgesMessage {
  type: typeof BADGES_MESSAGE
  badges: readonly Badge[]
}

/**
 * What the app knows of one of its resources, by name: its count on the tab
 * (`badge`), the tasks done in a project, the files of a drive. The names
 * are agreed with TwakeSpace.
 */
export interface Metadata {
  resourceId: string
  name: string
  value: number | string
}

/**
 * The metadata of the app for every resource it knows, shown on the tabs and
 * the home of each space. Each message replaces the previous one; an entry
 * left out is not known. Once an app sends it, TwakeSpace reads its tab
 * counts from the `badge` entries rather than from `twake-embed:badges`.
 */
export interface MetadataMessage {
  type: typeof METADATA_MESSAGE
  metadata: readonly Metadata[]
}

/**
 * A notification of the system, shown by TwakeSpace for the app: a frame of
 * another origin may not show one (Chat, for a call that rings). One per
 * `tag`: a new one with the same tag replaces it. `resourceId`, the resource
 * it is about (as in the badges): TwakeSpace opens its space on a click;
 * without it, the space the frame shows
 */
export interface NotificationMessage {
  type: typeof NOTIFICATION_MESSAGE
  tag: string
  title: string
  body: string
  resourceId?: string
}

/** The notification of that tag is over: TwakeSpace closes it */
export interface NotificationCloseMessage {
  type: typeof NOTIFICATION_CLOSE_MESSAGE
  tag: string
}

/**
 * The app asks TwakeSpace to open a call at `url` in its own call window,
 * floating over its page (a Meet room from an event, from a message).
 * TwakeSpace decides what it opens: a URL that is not a room of its Meet is
 * dropped, so the app opens it itself where it is not framed.
 */
export interface PipMessage {
  type: typeof PIP_MESSAGE
  url: string
}

/**
 * Whether the files of the upload `id` were stored: the answer to
 * `twake-embed:upload`. An app with no upload answers false at once.
 */
export interface UploadDoneMessage {
  type: typeof UPLOAD_DONE_MESSAGE
  id: string
  ok: boolean
}

/**
 * Files the user picked in TwakeSpace, for the app to store in its resource:
 * a drive keeps them at its root. The picker opens in TwakeSpace, where the
 * user clicked: a frame may not open one without a click of its own.
 */
export interface UploadMessage {
  type: typeof UPLOAD_MESSAGE
  id: string
  resourceId: string
  files: readonly File[]
}

/** Show another resource, at `path`, in the same frame */
export interface LoadMessage {
  type: typeof LOAD_MESSAGE
  resourceId: string
  path: string
}

/** Back, Forward or a deep link within the resource shown */
export interface NavigateMessage {
  type: typeof NAVIGATE_MESSAGE
  resourceId: string
  path: string
}

/**
 * TwakeSpace greets the frame on each of its loads: the app learns the
 * origin of its host from it, and answers from then on
 */
export interface HelloMessage {
  type: typeof HELLO_MESSAGE
}

/** From the app to TwakeSpace */
export type AppMessage =
  | ReadyMessage
  | PathMessage
  | LoginRequiredMessage
  | OverlayRegionMessage
  | FillPageMessage
  | BadgesMessage
  | MetadataMessage
  | NotificationMessage
  | NotificationCloseMessage
  | PipMessage
  | UploadDoneMessage

/** From TwakeSpace to the app */
export type HostMessage =
  HelloMessage | LoadMessage | NavigateMessage | UploadMessage

export interface OverlayBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The part of the overlay TwakeSpace shows: 'full' while something there
 * blocks the page (a dialog, a menu), otherwise the boxes the app draws, in
 * CSS px of the window
 */
export type OverlayRegion = 'full' | readonly OverlayBox[]

export function pathMessage(
  resourceId: string,
  path: string,
  replace: boolean
): PathMessage {
  return { type: PATH_MESSAGE, resourceId, path, replace }
}

export function readyMessage(): ReadyMessage {
  return { type: READY_MESSAGE }
}

export function loginRequiredMessage(): LoginRequiredMessage {
  return { type: LOGIN_REQUIRED_MESSAGE }
}

export function overlayRegionMessage(
  region: OverlayRegion
): OverlayRegionMessage {
  return { type: OVERLAY_REGION_MESSAGE, region }
}

export function fillPageMessage(fill: boolean): FillPageMessage {
  return { type: FILL_PAGE_MESSAGE, fill }
}

export function badgesMessage(badges: readonly Badge[]): BadgesMessage {
  return { type: BADGES_MESSAGE, badges }
}

export function metadataMessage(
  metadata: readonly Metadata[]
): MetadataMessage {
  return { type: METADATA_MESSAGE, metadata }
}

export function notificationMessage(notice: {
  tag: string
  title: string
  body: string
  resourceId?: string
}): NotificationMessage {
  return { type: NOTIFICATION_MESSAGE, ...notice }
}

export function notificationCloseMessage(
  tag: string
): NotificationCloseMessage {
  return { type: NOTIFICATION_CLOSE_MESSAGE, tag }
}

export function pipMessage(url: string): PipMessage {
  return { type: PIP_MESSAGE, url }
}

export function loadMessage(resourceId: string, path: string): LoadMessage {
  return { type: LOAD_MESSAGE, resourceId, path }
}

export function navigateMessage(
  resourceId: string,
  path: string
): NavigateMessage {
  return { type: NAVIGATE_MESSAGE, resourceId, path }
}

export function helloMessage(): HelloMessage {
  return { type: HELLO_MESSAGE }
}

export function uploadMessage(
  id: string,
  resourceId: string,
  files: readonly File[]
): UploadMessage {
  return { type: UPLOAD_MESSAGE, id, resourceId, files }
}

export function uploadDoneMessage(id: string, ok: boolean): UploadDoneMessage {
  return { type: UPLOAD_DONE_MESSAGE, id, ok }
}

const MAX_FILES = 100

/** Files as sent, bounded: from 1 to 100 of them */
export function parseFiles(value: unknown): File[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILES) {
    return null
  }
  return value.every(file => file instanceof File) ? [...value] : null
}

const MAX_BOXES = 32
const MAX_SIZE = 100_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_SIZE
  )
}

function toBox(value: unknown): OverlayBox | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (
    !isCoordinate(x) ||
    !isCoordinate(y) ||
    !isCoordinate(width) ||
    !isCoordinate(height)
  ) {
    return null
  }
  if (width < 0 || height < 0) return null
  return { x, y, width, height }
}

/** A region as reported, bounded: at most 32 boxes of a sane size */
export function parseOverlayRegion(value: unknown): OverlayRegion | null {
  if (value === 'full') return 'full'
  if (!Array.isArray(value) || value.length > MAX_BOXES) return null
  const boxes: OverlayBox[] = []
  for (const item of value) {
    const box = toBox(item)
    if (box === null) return null
    boxes.push(box)
  }
  return boxes
}

const MAX_BADGES = 1_000
const MAX_COUNT = 1_000_000
const MAX_ID_LENGTH = 256

function toBadge(value: unknown): Badge | null {
  if (!isRecord(value)) return null
  const { resourceId, count } = value
  if (
    typeof resourceId !== 'string' ||
    resourceId === '' ||
    resourceId.length > MAX_ID_LENGTH
  ) {
    return null
  }
  if (typeof count !== 'number' || !Number.isInteger(count)) return null
  if (count < 0 || count > MAX_COUNT) return null
  return { resourceId, count }
}

/**
 * Counts as reported, bounded: at most 1000 resources, each with a whole
 * count from 0 to a million
 */
export function parseBadges(value: unknown): Badge[] | null {
  if (!Array.isArray(value) || value.length > MAX_BADGES) return null
  const badges: Badge[] = []
  for (const item of value) {
    const badge = toBadge(item)
    if (badge === null) return null
    badges.push(badge)
  }
  return badges
}

const MAX_METADATA = 1_000
const METADATA_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/
const MAX_NAME_LENGTH = 64
const MAX_VALUE_LENGTH = 256

function isMetadataValue(value: unknown): value is number | string {
  if (typeof value === 'string') return value.length <= MAX_VALUE_LENGTH
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_COUNT
  )
}

function toMetadata(value: unknown): Metadata | null {
  if (!isRecord(value)) return null
  const { resourceId, name, value: entry } = value
  if (
    typeof resourceId !== 'string' ||
    resourceId === '' ||
    resourceId.length > MAX_ID_LENGTH
  ) {
    return null
  }
  if (
    typeof name !== 'string' ||
    name.length > MAX_NAME_LENGTH ||
    !METADATA_NAME.test(name)
  ) {
    return null
  }
  return isMetadataValue(entry) ? { resourceId, name, value: entry } : null
}

/**
 * Metadata as reported, bounded: at most 1000 entries, each a dotted
 * lowercase name and a whole value from 0 to a million or a text of at most
 * 256 characters
 */
export function parseMetadata(value: unknown): Metadata[] | null {
  if (!Array.isArray(value) || value.length > MAX_METADATA) return null
  const metadata: Metadata[] = []
  for (const item of value) {
    const entry = toMetadata(item)
    if (entry === null) return null
    metadata.push(entry)
  }
  return metadata
}

const MAX_TITLE_LENGTH = 256
const MAX_BODY_LENGTH = 1_000

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max

const isTag = (value: unknown): value is string =>
  isText(value, MAX_ID_LENGTH) && value !== ''

const MAX_URL_LENGTH = 2_048

/** An absolute http(s) URL of a sane length, as the browser reads it */
export function parsePipUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

function isResourceAndPath(
  data: Record<string, unknown>
): data is Record<string, unknown> & { resourceId: string; path: string } {
  return (
    typeof data.resourceId === 'string' &&
    data.resourceId !== '' &&
    typeof data.path === 'string' &&
    isBelow(data.path)
  )
}

/** What an app sent, or null */
export function parseAppMessage(data: unknown): AppMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case READY_MESSAGE:
      return readyMessage()
    case PATH_MESSAGE:
      return isResourceAndPath(data)
        ? pathMessage(data.resourceId, data.path, data.replace !== false)
        : null
    case LOGIN_REQUIRED_MESSAGE:
      return loginRequiredMessage()
    case OVERLAY_REGION_MESSAGE: {
      const region = parseOverlayRegion(data.region)
      return region === null ? null : overlayRegionMessage(region)
    }
    case FILL_PAGE_MESSAGE:
      return typeof data.fill === 'boolean' ? fillPageMessage(data.fill) : null
    case BADGES_MESSAGE: {
      const badges = parseBadges(data.badges)
      return badges === null ? null : badgesMessage(badges)
    }
    case METADATA_MESSAGE: {
      const metadata = parseMetadata(data.metadata)
      return metadata === null ? null : metadataMessage(metadata)
    }
    case NOTIFICATION_MESSAGE: {
      const { tag, title, body, resourceId } = data
      if (resourceId !== undefined && !isTag(resourceId)) return null
      return isTag(tag) &&
        isText(title, MAX_TITLE_LENGTH) &&
        title !== '' &&
        isText(body, MAX_BODY_LENGTH)
        ? notificationMessage(
            resourceId === undefined
              ? { tag, title, body }
              : { tag, title, body, resourceId }
          )
        : null
    }
    case NOTIFICATION_CLOSE_MESSAGE:
      return isTag(data.tag) ? notificationCloseMessage(data.tag) : null
    case PIP_MESSAGE: {
      const url = parsePipUrl(data.url)
      return url === null ? null : pipMessage(url)
    }
    case UPLOAD_DONE_MESSAGE:
      return isTag(data.id) && typeof data.ok === 'boolean'
        ? uploadDoneMessage(data.id, data.ok)
        : null
    default:
      return null
  }
}

/** What TwakeSpace sent, or null */
export function parseHostMessage(data: unknown): HostMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case HELLO_MESSAGE:
      return helloMessage()
    case LOAD_MESSAGE:
      return isResourceAndPath(data)
        ? loadMessage(data.resourceId, data.path)
        : null
    case NAVIGATE_MESSAGE:
      return isResourceAndPath(data)
        ? navigateMessage(data.resourceId, data.path)
        : null
    case UPLOAD_MESSAGE: {
      const files = parseFiles(data.files)
      return isTag(data.id) && isTag(data.resourceId) && files !== null
        ? uploadMessage(data.id, data.resourceId, files)
        : null
    }
    default:
      return null
  }
}
