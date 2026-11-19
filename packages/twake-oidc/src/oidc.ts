import * as client from 'openid-client'

import {
  endLocalSession,
  getIdToken,
  setTokenSet,
  type TokenSet
} from './session'

export interface AuthConfig {
  /** Issuer URL of the SSO, where its OIDC discovery document lives */
  ssoUrl: string
  clientId: string
  scope: string
  /**
   * Page of the application the SSO sends the user back to, or the backend
   * that relays the answer to the page (`relayState`)
   */
  redirectUri: string
  postLogoutRedirectUri: string
  /** Backend of the application: the only one that gets the access token */
  apiUrl: string
  /**
   * The page is shown in the frame of another app (Twake Space): the SSO
   * refuses to show its portal there, so the sign-in asks it to show nothing
   * (`prompt=none`) and replaces the page, leaving no entry in the history the
   * frame shares with the page around it. Read at each sign-in: an app framed
   * on some of its routes only gives a function.
   */
  framed?: boolean | (() => boolean)
  /**
   * Framed, the session ended (the backend answered 401): a frame never
   * navigates its document after its boot, so instead of signing in again
   * the app tells the page around it, which signs the user in at the top
   * level (Twake Space: `twake-embed:login-required`). Called once.
   */
  onLoginRequired?: () => void
  /**
   * Values for a backend that relays the SSO's answer to the page, when the
   * redirect URI is that backend (e.g. the origin of the page, for a backend
   * serving many hosts of the application). They travel in the state, as
   * base64url JSON, next to a random nonce no value replaces.
   */
  relayState?: () => Record<string, string>
}

export interface LoginResult {
  tokenSet: TokenSet
  userinfo: client.UserInfoResponse
  /** Path of the application the user was on when the sign-in started */
  returnTo: string
}

interface RedirectState {
  code_verifier: string
  state: string
  returnTo: string
  /** Asked with `prompt=none`: the SSO may answer that it needs the user */
  silent?: boolean
}

const DISCOVERY_TIMEOUT_S = 10
const REDIRECT_STATE_KEY = 'redirectState'
/**
 * Answers of the SSO to a silent sign-in when it would have to show a page:
 * no session, consent, account choice (OpenID Connect Core 1.0, 3.1.2.6)
 */
const LOGIN_REQUIRED_ERRORS = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required'
])

export const isLoginRequired = (error: string | null): boolean =>
  LOGIN_REQUIRED_ERRORS.has(error ?? '')

/**
 * A silent sign-in was refused: the SSO needs the user, who signs in again
 * where the SSO may show its portal (the page around the frame).
 */
export class LoginRequiredError extends Error {
  /** Path of the application the sign-in started from */
  readonly returnTo: string

  constructor(returnTo: string) {
    super('The SSO needs the user to sign in')
    this.name = 'LoginRequiredError'
    this.returnTo = returnTo
  }
}

let authConfig: AuthConfig | null = null

export function configureAuth(config: AuthConfig): void {
  authConfig = config
}

export function getAuthConfig(): AuthConfig {
  if (!authConfig) {
    throw new Error('twake-oidc is not configured: call configureAuth first')
  }
  return authConfig
}

export const isOnRedirectUri = (): boolean => {
  const { redirectUri, relayState } = getAuthConfig()
  if (relayState) {
    // The backend relays the SSO's answer, in the query, to any page
    const answer = new URL(window.location.href).searchParams
    return answer.has('state') && (answer.has('code') || answer.has('error'))
  }
  return (
    window.location.pathname ===
    new URL(redirectUri, window.location.href).pathname
  )
}

export async function discover(): Promise<client.Configuration> {
  const { ssoUrl, clientId } = getAuthConfig()
  const issuer = new URL(ssoUrl)
  return await client.discovery(
    issuer,
    clientId,
    // Tolerate up to 5 minutes of clock skew between browser and SSO server
    { [client.clockSkew]: 300 },
    undefined,
    {
      timeout: DISCOVERY_TIMEOUT_S,
      // Local and QA stacks serve their SSO over plain HTTP on a .localhost
      // host, which the browser keeps on the machine
      ...(issuer.protocol === 'http:' &&
        /(^|\.)localhost$/.test(issuer.hostname) && {
          execute: [client.allowInsecureRequests]
        })
    }
  )
}

export const isFramed = (): boolean => {
  const { framed } = getAuthConfig()
  return typeof framed === 'function' ? framed() : framed === true
}

function buildState(): string {
  const nonce = client.randomState()
  const relayState = getAuthConfig().relayState?.()
  if (!relayState) return nonce

  const json = new TextEncoder().encode(
    JSON.stringify({ ...relayState, nonce })
  )
  return btoa(String.fromCharCode(...json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function readRedirectState(): RedirectState | null {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(REDIRECT_STATE_KEY) ?? 'null'
    ) as Partial<RedirectState> | null
    if (saved?.code_verifier && saved.state) {
      return { returnTo: '/', ...saved } as RedirectState
    }
  } catch {
    // An unreadable state is no pending sign-in
  }
  return null
}

/**
 * The path the pending sign-in comes back to, without finishing it: the
 * callback page reads it to know which screen the sign-in is for. Null when
 * no sign-in is pending.
 */
export function getPendingReturnTo(): string | null {
  return readRedirectState()?.returnTo ?? null
}

// A path starting with // would be a protocol-relative URL to another site.
export const currentPath = (): string => {
  const { pathname, search, hash } = window.location
  return pathname.replace(/^\/+/, '/') + search + hash
}

export interface Authorization {
  url: URL
  codeVerifier: string
  state: string
  configuration?: client.Configuration
}

export async function authorize(silent: boolean): Promise<Authorization> {
  const { redirectUri, scope } = getAuthConfig()
  const codeVerifier = client.randomPKCECodeVerifier()
  const state = buildState()
  const configuration = await discover()
  const url = client.buildAuthorizationUrl(configuration, {
    redirect_uri: redirectUri,
    scope,
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state,
    ...(silent && { prompt: 'none' })
  })
  return { url, codeVerifier, state, configuration }
}

/**
 * Trades the code of the SSO's answer for the tokens, which are kept for the
 * API requests, and reads the user's claims.
 */
export async function exchangeCode(
  answer: URL,
  { codeVerifier, state, ...discovered }: Omit<Authorization, 'url'>
): Promise<Omit<LoginResult, 'returnTo'>> {
  // The token request names the redirect URI the SSO sent the code to, which
  // is not the page the answer reached when a backend relays it there
  const callbackUrl = new URL(getAuthConfig().redirectUri, window.location.href)
  callbackUrl.search = answer.search

  const configuration = discovered.configuration ?? (await discover())
  const tokenSet = await client.authorizationCodeGrant(
    configuration,
    callbackUrl,
    { pkceCodeVerifier: codeVerifier, expectedState: state }
  )
  const sub = tokenSet.claims()?.sub
  if (!sub) throw new Error('The SSO returned no ID token')

  const userinfo = await client.fetchUserInfo(
    configuration,
    tokenSet.access_token,
    sub
  )
  setTokenSet(tokenSet)
  return { tokenSet, userinfo }
}

/**
 * Sends the user to the SSO, which sends them back to the redirect URI where
 * completeLogin finishes the sign-in. Framed, the SSO shows nothing.
 */
export async function startLogin(): Promise<void> {
  const silent = isFramed()
  const { url: authorizationUrl, codeVerifier, state } = await authorize(silent)
  const redirectState: RedirectState = {
    code_verifier: codeVerifier,
    state,
    // The redirect URI holds a spent code: coming back there would start over
    returnTo: isOnRedirectUri() ? '/' : currentPath(),
    ...(silent && { silent })
  }
  sessionStorage.setItem(REDIRECT_STATE_KEY, JSON.stringify(redirectState))
  if (silent) window.location.replace(authorizationUrl)
  else window.location.assign(authorizationUrl)
}

/**
 * Finishes, on the page the SSO's answer reaches (the redirect URI, or the
 * page a backend relays it to), the sign-in started by startLogin: the
 * tokens are kept for the API requests before this resolves.
 *
 * @returns null when no sign-in is pending, e.g. the page was reloaded.
 * @throws LoginRequiredError when the SSO refused a silent sign-in.
 */
export async function completeLogin(): Promise<LoginResult | null> {
  const saved = readRedirectState()
  sessionStorage.removeItem(REDIRECT_STATE_KEY)
  if (!saved) return null

  const answer = new URL(window.location.href)
  if (
    saved.silent &&
    isLoginRequired(answer.searchParams.get('error')) &&
    answer.searchParams.get('state') === saved.state
  ) {
    throw new LoginRequiredError(saved.returnTo)
  }

  const login = await exchangeCode(answer, {
    codeVerifier: saved.code_verifier,
    state: saved.state
  })
  return { ...login, returnTo: saved.returnTo }
}

/**
 * Ends the session here and on the SSO, then leaves the application.
 */
export async function logOut(): Promise<void> {
  const idToken = getIdToken()
  try {
    const configuration = await discover()
    const endSessionUrl = client.buildEndSessionUrl(configuration, {
      post_logout_redirect_uri: getAuthConfig().postLogoutRedirectUri,
      ...(idToken && { id_token_hint: idToken })
    })

    endLocalSession()

    window.location.assign(endSessionUrl)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Logout failed:', error)

    endLocalSession()
    window.location.assign('/')
  }
}
