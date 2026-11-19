import type { Credentials } from './types'

interface TokenResponse {
  access_token: string
  refresh_token?: string
  client_id?: string
  client_secret?: string
  scope?: string
}

/** The scope of a linked-app token is `@io.cozy.apps/<slug>` */
const linkedAppSlug = (scope = ''): string | null =>
  /^@io\.cozy\.apps\/([^\s/]+)$/.exec(scope)?.[1] ?? null

export class SdkAuthError extends Error {
  readonly status: number

  constructor(route: string, status: number) {
    super(`[twake-sdk] ${route} failed: ${status}`)
    this.name = 'SdkAuthError'
    this.status = status
  }
}

const readToken = async (
  route: string,
  response: Response
): Promise<TokenResponse> => {
  if (!response.ok) throw new SdkAuthError(route, response.status)
  return (await response.json()) as TokenResponse
}

/**
 * Exchanges the OIDC id token of the host for a token of the platform. The
 * token has the permissions of the container app linked to the id token
 * audience, and comes with the OAuth client able to refresh it.
 */
export async function exchangeIdToken(
  platformURL: string,
  idToken: string
): Promise<Credentials> {
  const response = await fetch(new URL('/auth/token_exchange', platformURL), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken, exchange_type: 'app' })
  })
  const token = await readToken('token_exchange', response)
  if (!token.refresh_token || !token.client_id || !token.client_secret) {
    throw new SdkAuthError('token_exchange', response.status)
  }
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    clientId: token.client_id,
    clientSecret: token.client_secret,
    appSlug: linkedAppSlug(token.scope)
  }
}

/** Gets a new access token with the refresh token, the other credentials stay */
export async function refreshCredentials(
  platformURL: string,
  credentials: Credentials
): Promise<Credentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  })
  const response = await fetch(new URL('/auth/access_token', platformURL), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body
  })
  const token = await readToken('access_token', response)
  return { ...credentials, accessToken: token.access_token }
}
