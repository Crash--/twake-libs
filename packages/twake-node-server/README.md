# twake-node-server

The HTTP server, shutdown and Postgres setup a Twake Node backend starts from.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-node-server
```

`fastify` is a peer. `drizzle-orm` and `postgres` are optional peers, needed only for the `./postgres` entry point.

## Usage

```ts
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'
import { createServer, handleSignals } from '@linagora/twake-node-server'
import { createDb, migrateDb } from '@linagora/twake-node-server/postgres'

const log = pino()
const lifecycle = handleSignals({ log, deadlineMs: 25_000 })

const { sql, db } = createDb(process.env.DATABASE_URL, { log })
await migrateDb(sql, fileURLToPath(new URL('../drizzle', import.meta.url)))

const app = createServer({
  logger: log,
  isReady: async () => (await sql`select 1`).length === 1
})
await app.listen({ host: '0.0.0.0', port: 8080 })

lifecycle.started(async () => {
  await app.close()
  await sql.end()
})
```

## Server

`createServer` returns a Fastify instance with:

- `GET /health/live`, 200, or 503 once `isAlive` returns false.
- `GET /health/ready`, 200 when `isReady` resolves to true, 503 otherwise.
- An error handler that keeps 4xx answers and turns every 5xx into `{ "error": "server_error" }`, logging the error. A failed query's message holds its SQL and parameters, so it never reaches the client.
- Request logs that leave out health checks and the query string, which can carry search terms and shared links.

Other Fastify options, such as `trustProxy` or `routerOptions`, go in `fastify`.

## Shutdown

`handleSignals` handles SIGTERM and SIGINT once:

- Before `started` is called, the process exits at once: nothing serves traffic yet, and an unfinished migration rolls back.
- After it, the function given to `started` runs, and the process exits 0 when it resolves, or 1 when it fails or outlives `deadlineMs`.

## Postgres

`@linagora/twake-node-server/postgres` works with drizzle over postgres.js.

- `createDb(url, { log, poolMax })` connects and returns `{ sql, db }`.
- `afterCommit(tx, hook)` runs `hook` once the transaction commits, and never if it rolls back. A savepoint that rolls back alone drops its hooks. A hook that throws or rejects is logged.
- `migrateDb(sql, migrationsFolder)` applies the drizzle migrations under a Postgres advisory lock, so replicas starting together apply each one once. The lock holds one connection while the migration runs on another, so the pool needs at least 2. On Postgres before 18, it first creates the `uuidv7()` function that 18 has built in.
- `isTransient(error)` tells whether an error, or one of its causes, may pass when tried again: a lost connection, a serialization failure, a deadlock, a lock or statement timeout.
