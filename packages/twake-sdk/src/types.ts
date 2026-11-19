/** What the SDK is showing to the host: no user, user logging in, user known */
export type SdkStatus = 'public' | 'waiting' | 'ready'

export interface SdkOptions {
  /** URL of the user's platform: `https://${workplaceFqdn}` */
  platformURL: string
  /** OIDC id token of the user, when the host is already signed in */
  idToken?: string
  /** Milliseconds before a client left `waiting` falls back to `public` */
  waitingTimeout?: number
}

/** Tokens returned by `POST /auth/token_exchange` */
export interface Credentials {
  accessToken: string
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Slug of the container app the token is linked to, null without one */
  appSlug: string | null
}

/** An `io.cozy.apps` document, attributes and links flattened */
export interface App {
  id: string
  slug: string
  name: string
  name_prefix?: string
  state: string
  standalone?: boolean
  client_url_flag?: string
  entrypoints?: Entrypoint[]
  locales?: Record<string, { name?: string; name_prefix?: string }>
  links: { related?: string; icon?: string }
  [attribute: string]: unknown
}

export interface Entrypoint {
  name: string
  title: Record<string, string>
  hash: string
  icon?: string
  conditions?: EntrypointCondition[]
}

export interface EntrypointCondition {
  type: 'flag'
  name: string
  value: unknown
}

/** `GET /settings/instance` and `GET /settings/disk-usage`, merged */
export interface Instance {
  email?: string
  public_name?: string
  locale?: string
  /** Bytes used, null when the app may not read the disk usage */
  diskUsage: number | null
  /** Bytes allowed, null when not limited or not readable */
  diskQuota: number | null
  [attribute: string]: unknown
}

export type Flags = Record<string, unknown>

/** `GET /settings/context`: what the context configures for the instance */
export interface Context {
  help_link?: string
  manager_url?: string
  [attribute: string]: unknown
}

/** A shortcut file of the Home folder */
export interface Shortcut {
  id: string
  name: string
  url: string
  /** Data URL of the shortcut icon, null when it has none */
  icon: string | null
}

export interface IntentRequest {
  action: string
  type: string
  data?: unknown
  permissions?: string[]
}

export interface Intent {
  id: string
  action: string
  type: string
  services: { slug: string; href: string }[]
  [attribute: string]: unknown
}
