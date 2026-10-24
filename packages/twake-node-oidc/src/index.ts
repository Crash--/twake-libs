import {
  createAuthenticator,
  type Authenticate,
  type AuthenticatorOptions
} from './authenticator.js'
import {
  discoverIdentityProvider,
  type IdentityProvider,
  type OidcOptions
} from './provider.js'
import type { AuthStore } from './store.js'

export {
  createAuthenticator,
  TooManyNewTokensError,
  type Authenticate,
  type AuthenticatorOptions
} from './authenticator.js'
export {
  discoverIdentityProvider,
  type Identity,
  type IdentityProvider,
  type OidcOptions,
  type OrganizationRole
} from './provider.js'
export { memoryAuthStore, type AuthStore } from './store.js'

export interface Oidc {
  provider: IdentityProvider
  store: AuthStore
  authenticate: Authenticate
}

export async function connectOidc(
  options: OidcOptions & { store: AuthStore } & Pick<
      AuthenticatorOptions,
      'newTokenChecks' | 'newTokensWaiting'
    >
): Promise<Oidc> {
  const provider = await discoverIdentityProvider(options)
  return {
    provider,
    store: options.store,
    authenticate: createAuthenticator({ ...options, provider })
  }
}
