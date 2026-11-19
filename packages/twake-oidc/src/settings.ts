import type { AuthConfig } from './oidc'

const SETTINGS = [
  'SSO_BASE_URL',
  'SSO_CLIENT_ID',
  'SSO_SCOPE',
  'SSO_REDIRECT_URI',
  'SSO_POST_LOGOUT_REDIRECT'
] as const

/** The SSO settings a Twake app's `/env.js` puts on `window` */
export type SsoSettings = Partial<Record<(typeof SETTINGS)[number], string>>

/**
 * The AuthConfig of a Twake app, from the settings its `/env.js` sets.
 *
 * @throws when one of them is missing or empty.
 */
export function readAuthConfig(
  settings: SsoSettings,
  apiUrl: string
): AuthConfig {
  const missing = SETTINGS.filter(name => !settings[name])
  if (missing.length > 0) {
    throw new Error(`/env.js must set ${missing.join(', ')}`)
  }
  return {
    ssoUrl: settings.SSO_BASE_URL as string,
    clientId: settings.SSO_CLIENT_ID as string,
    scope: settings.SSO_SCOPE as string,
    redirectUri: settings.SSO_REDIRECT_URI as string,
    postLogoutRedirectUri: settings.SSO_POST_LOGOUT_REDIRECT as string,
    apiUrl
  }
}
