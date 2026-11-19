import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import type { AuthStore } from './store.js'

// Export it from the service's drizzle schema so its migrations create it.
export const oidcRevokedSessions = pgTable(
  'oidc_revoked_sessions',
  {
    sid: text().primaryKey(),
    revokedAt: timestamp('revoked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
  },
  table => [index().on(table.expiresAt)]
)

// Shared by every replica: a logout received by one is seen by all.
export function drizzleAuthStore(
  db: PgAsyncDatabase<PgQueryResultHKT>
): AuthStore {
  return {
    async isRevoked(sessionId): Promise<boolean> {
      const rows = await db
        .select({ sid: oidcRevokedSessions.sid })
        .from(oidcRevokedSessions)
        .where(
          and(
            eq(oidcRevokedSessions.sid, sessionId),
            gt(oidcRevokedSessions.expiresAt, new Date())
          )
        )
        .limit(1)
      return rows.length > 0
    },

    async revoke(sessionId, until): Promise<void> {
      await db.transaction(async tx => {
        await tx
          .delete(oidcRevokedSessions)
          .where(lt(oidcRevokedSessions.expiresAt, new Date()))
        await tx
          .insert(oidcRevokedSessions)
          .values({ sid: sessionId, expiresAt: until })
          .onConflictDoUpdate({
            target: oidcRevokedSessions.sid,
            set: {
              expiresAt: sql`greatest(${oidcRevokedSessions.expiresAt}, excluded.expires_at)`
            }
          })
      })
    }
  }
}
