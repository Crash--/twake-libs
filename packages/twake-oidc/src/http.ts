import { getAuthConfig, isFramed, isOnRedirectUri, startLogin } from './oidc'
import { getAccessToken } from './session'

let isRedirectingToSso = false
let hasReportedLoginRequired = false

const isApiRequest = (request: Request): boolean => {
  try {
    const target = new URL(request.url, window.location.href)
    const api = new URL(getAuthConfig().apiUrl, window.location.href)
    return target.origin === api.origin
  } catch {
    return false
  }
}

/**
 * ky beforeRequest hook: hands the access token to the requests sent to the
 * application backend, and to no other service.
 */
export function addAuthorization(request: Request): void {
  const accessToken = getAccessToken()
  if (
    accessToken &&
    !request.headers.has('Authorization') &&
    isApiRequest(request)
  ) {
    request.headers.set('Authorization', `Bearer ${accessToken}`)
  }
}

/**
 * ky afterResponse hook: a 401 from the application backend to a request that
 * carried a token means the session is over, so the user signs in again.
 * Framed, the page around signs them in instead (`onLoginRequired`).
 */
export async function redirectOnUnauthorized(
  request: Request,
  _options: unknown,
  response: Response
): Promise<void> {
  if (
    response.status !== 401 ||
    !request.headers.has('Authorization') ||
    !isApiRequest(request) ||
    // The sign-in is being completed there: redirecting would loop
    isOnRedirectUri()
  ) {
    return
  }
  if (isFramed()) {
    // ky then rejects the request with the 401
    if (!hasReportedLoginRequired) getAuthConfig().onLoginRequired?.()
    hasReportedLoginRequired = true
    return
  }
  if (isRedirectingToSso) {
    throw new DOMException('SSO redirect in progress', 'AbortError')
  }
  isRedirectingToSso = true
  try {
    await startLogin()
  } catch (error) {
    // ky then rejects the request with the 401
    isRedirectingToSso = false
    // eslint-disable-next-line no-console
    console.error('SSO redirect failed:', error)
  }
}
