import { expect, it } from 'vitest'

import { readAuthConfig } from './settings'

it('reads the SSO settings of /env.js', () => {
  expect(
    readAuthConfig(
      {
        SSO_BASE_URL: 'https://sso.example.com',
        SSO_CLIENT_ID: 'app',
        SSO_SCOPE: 'openid email',
        SSO_REDIRECT_URI: 'https://app.example.com/callback',
        SSO_POST_LOGOUT_REDIRECT: 'https://app.example.com'
      },
      'https://api.example.com'
    )
  ).toEqual({
    ssoUrl: 'https://sso.example.com',
    clientId: 'app',
    scope: 'openid email',
    redirectUri: 'https://app.example.com/callback',
    postLogoutRedirectUri: 'https://app.example.com',
    apiUrl: 'https://api.example.com'
  })
})

it('names the settings that are missing or empty', () => {
  expect(() =>
    readAuthConfig(
      {
        SSO_BASE_URL: 'https://sso.example.com',
        SSO_CLIENT_ID: '',
        SSO_REDIRECT_URI: 'https://app.example.com/callback',
        SSO_POST_LOGOUT_REDIRECT: 'https://app.example.com'
      },
      'https://api.example.com'
    )
  ).toThrow('/env.js must set SSO_CLIENT_ID, SSO_SCOPE')
})
