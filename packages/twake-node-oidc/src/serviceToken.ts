import * as client from 'openid-client'

import { discover, type OidcOptions } from './provider.js'

export interface ServiceToken {
  // An access token of the service's own client, kept until it nearly expires.
  getToken: () => Promise<string>
  // Drops a token the receiving service refused, unless it was replaced already.
  forget: (token: string) => void
}

export type ServiceTokenOptions = Pick<
  OidcOptions,
  'issuer' | 'clientId' | 'clientSecret'
> & {
  scope?: string
}

const TOKEN_MARGIN_MS = 30_000
// The lifetime of a token whose answer gives none.
const DEFAULT_TOKEN_LIFETIME_S = 60

export async function discoverServiceToken(
  options: ServiceTokenOptions
): Promise<ServiceToken> {
  const config = await discover(options)
  let token: { value: string; expiresAt: number } | null = null
  // Callers that need a token meanwhile share the request in flight.
  let request: Promise<string> | null = null

  async function requestToken(): Promise<string> {
    let answer: client.TokenEndpointResponse
    try {
      answer = await client.clientCredentialsGrant(
        config,
        options.scope === undefined ? {} : { scope: options.scope }
      )
    } catch (error) {
      // openid-client says "invalid response encountered"; its cause names
      // the field, e.g. a missing access_token.
      if (
        error instanceof client.ClientError &&
        error.code === 'OAUTH_INVALID_RESPONSE' &&
        error.cause instanceof Error
      ) {
        // eslint-disable-next-line preserve-caught-error -- its cause holds the response body, which may carry a token
        throw new Error(
          `${config.serverMetadata().issuer} answered an invalid token: ${error.cause.message}`
        )
      }
      throw error
    }
    const lifetime =
      answer.expires_in !== undefined && answer.expires_in > 0
        ? answer.expires_in
        : DEFAULT_TOKEN_LIFETIME_S
    token = {
      value: answer.access_token,
      // A short-lived token is kept for half its life rather than never.
      expiresAt:
        Date.now() + Math.max(lifetime * 1000 - TOKEN_MARGIN_MS, lifetime * 500)
    }
    return token.value
  }

  return {
    getToken(): Promise<string> {
      if (token && token.expiresAt > Date.now()) {
        return Promise.resolve(token.value)
      }
      request ??= requestToken().finally(() => {
        request = null
      })
      return request
    },

    forget(value): void {
      if (token?.value === value) token = null
    }
  }
}
