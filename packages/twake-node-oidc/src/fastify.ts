import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { TooManyNewTokensError } from './authenticator.js'
import type { Oidc } from './index.js'
import type { Identity } from './provider.js'

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null
  }
}

export type RequireIdentity = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<FastifyReply | undefined>

// Longer than any access token issued in the revoked session can live.
const REVOCATION_TTL_MS = 24 * 60 * 60 * 1000

const logoutBody = z.object({ logout_token: z.string().min(1) })

function unauthorized(reply: FastifyReply, error: string | null): FastifyReply {
  return reply
    .code(401)
    .header('www-authenticate', error ? `Bearer error="${error}"` : 'Bearer')
    .send({ error: 'unauthorized' })
}

export function bearerToken(request: FastifyRequest): string | null {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? []
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

// For a handler behind requireIdentity, which always sets it.
export function identityOf(request: FastifyRequest): Identity {
  if (!request.identity) throw new Error('the route does not require identity')
  return request.identity
}

// Adds the back-channel logout route, and returns the preHandler that puts
// the caller's identity on `request.identity`.
export function registerOidc(
  app: FastifyInstance,
  oidc: Oidc
): RequireIdentity {
  app.decorateRequest('identity', null)

  const requireIdentity: RequireIdentity = async (request, reply) => {
    const token = bearerToken(request)
    if (!token) return unauthorized(reply, null)
    let identity: Identity | null
    try {
      identity = await oidc.authenticate(token)
    } catch (error) {
      // A flood of made-up tokens: not one error report each.
      if (error instanceof TooManyNewTokensError) {
        request.log.warn(error.message)
      } else request.log.error({ err: error }, 'access token check failed')
      return reply.code(503).send({ error: 'unavailable' })
    }
    if (!identity) return unauthorized(reply, 'invalid_token')
    request.identity = identity
  }

  // In its own context, so the form parser stays on this route.
  void app.register(scope => {
    scope.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(body as string)))
      }
    )

    scope.post('/auth/backchannel-logout', async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const body = logoutBody.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({ error: 'invalid_request' })
      }
      let sessionId: string
      try {
        sessionId = await oidc.provider.verifyLogoutToken(
          body.data.logout_token
        )
      } catch (error) {
        request.log.warn({ err: error }, 'logout token refused')
        return reply.code(400).send({ error: 'invalid_request' })
      }
      await oidc.store.revoke(
        sessionId,
        new Date(Date.now() + REVOCATION_TTL_MS)
      )
      return reply.code(200).send()
    })
    return Promise.resolve()
  })

  return requireIdentity
}
