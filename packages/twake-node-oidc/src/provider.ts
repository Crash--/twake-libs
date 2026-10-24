import * as client from 'openid-client'
import { z } from 'zod'

const organizationRole = z.enum(['owner', 'admin', 'moderator', 'member'])
export type OrganizationRole = z.infer<typeof organizationRole>

export interface Identity {
  subject: string
  // The LDAP entryUUID: the person, whatever their email.
  userId: string
  email: string
  name: string | null
  sessionId: string
  expiresAt: Date
  // null for a B2C user.
  organizationId: string | null
  organizationRole: OrganizationRole | null
}

export interface IdentityProvider {
  identify: (accessToken: string) => Promise<Identity | null>
}

export interface OidcOptions {
  issuer: URL
  clientId: string
  clientSecret: string
  // The `aud` an access token must carry to be accepted here.
  audience: string
}

const userinfoSchema = z.object({
  sub: z.string().min(1),
  // LemonLDAP's introspection does not return the sid.
  sid: z.string().min(1),
  uuid: z.uuid(),
  email: z.email(),
  name: z.string().nullish().catch(null),
  given_name: z.string().nullish().catch(null),
  family_name: z.string().nullish().catch(null),
  org_id: z.string().min(1).nullish(),
  org_role: organizationRole.nullish().catch(null)
})

// The name claim can be the uid (it is LemonLDAP's cn), so the given and
// family names come first.
function nameOf(claims: z.infer<typeof userinfoSchema>): string | null {
  const full = [claims.given_name, claims.family_name]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ')
  return full || claims.name?.trim() || null
}

// openid-client URL-encodes Basic credentials (RFC 6749 2.3.1), and LemonLDAP
// before 2.23 does not decode them: "-" would arrive as "%2D". Raw ones work on
// every version as long as the id and secret hold no "%" or ":".
function rawClientSecretBasic(clientSecret: string): client.ClientAuth {
  return (_server, { client_id }, _body, headers) => {
    headers.set(
      'authorization',
      `Basic ${btoa(`${client_id}:${clientSecret}`)}`
    )
  }
}

function hasAudience(
  aud: string | string[] | undefined,
  audience: string
): boolean {
  return Array.isArray(aud) ? aud.includes(audience) : aud === audience
}

export async function discoverIdentityProvider(
  options: OidcOptions
): Promise<IdentityProvider> {
  const config = await client.discovery(
    options.issuer,
    options.clientId,
    undefined,
    rawClientSecretBasic(options.clientSecret),
    {
      timeout: 5,
      // A local stack's LemonLDAP only speaks plain HTTP.
      execute:
        options.issuer.protocol === 'http:'
          ? [client.allowInsecureRequests]
          : []
    }
  )
  const metadata = config.serverMetadata()
  if (!metadata.jwks_uri) {
    throw new Error(`${metadata.issuer} publishes no jwks_uri`)
  }

  return {
    async identify(accessToken): Promise<Identity | null> {
      // In parallel, so the subjects are compared below rather than by
      // openid-client.
      const [introspection, userinfo] = await Promise.allSettled([
        client.tokenIntrospection(config, accessToken),
        client.fetchUserInfo(config, accessToken, client.skipSubjectCheck)
      ])
      if (introspection.status === 'rejected') throw introspection.reason
      const token = introspection.value
      if (
        !token.active ||
        token.exp === undefined ||
        token.exp * 1000 <= Date.now() ||
        !hasAudience(token.aud, options.audience)
      ) {
        return null
      }
      if (userinfo.status === 'rejected') {
        // The session can end between the two calls.
        if (
          userinfo.reason instanceof client.WWWAuthenticateChallengeError &&
          userinfo.reason.status === 401
        ) {
          return null
        }
        throw userinfo.reason
      }
      const parsed = userinfoSchema.safeParse(userinfo.value)
      if (!parsed.success) return null
      const claims = parsed.data
      if (token.sub !== undefined && token.sub !== claims.sub) return null

      return {
        subject: claims.sub,
        userId: claims.uuid,
        email: claims.email,
        name: nameOf(claims),
        sessionId: claims.sid,
        expiresAt: new Date(token.exp * 1000),
        organizationId: claims.org_id ?? null,
        organizationRole: claims.org_role ?? null
      }
    }
  }
}
