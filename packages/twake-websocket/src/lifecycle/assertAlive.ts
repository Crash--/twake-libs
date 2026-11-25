import { type MutableRefObject } from 'react'

import type { WebSocketWithCleanup } from '../connection/types.js'
import { getWebSocketState } from '../connection/webSocketState.js'

const DEFAULT_TIMEOUT_MS = 10_000
let inFlightCheck: Promise<void> | null = null

function waitForSocketOpen(
  socketRef: MutableRefObject<WebSocketWithCleanup | null>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + DEFAULT_TIMEOUT_MS

    const poll = (): void => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return resolve()
      if (Date.now() >= deadline)
        return reject(new Error('[WS] Timed out waiting for reconnection'))
      setTimeout(poll, 100)
    }

    poll()
  })
}

export function assertWebSocketAlive(timeoutMs?: number): Promise<void> {
  if (inFlightCheck) return inFlightCheck
  const { socketRef, triggerReconnect, isConnecting } = getWebSocketState()

  // Not registered yet or mid-bootstrap — don't interfere, don't block
  if (!socketRef || isConnecting || !triggerReconnect) return Promise.resolve()

  const socket = socketRef.current

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    triggerReconnect()
    return waitForSocketOpen(socketRef)
  }

  const TIMEOUT_MS = timeoutMs ?? DEFAULT_TIMEOUT_MS

  const promise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      // eslint-disable-next-line no-console
      console.warn('[WS] Pong not received — triggering reconnect')
      triggerReconnect()
      waitForSocketOpen(socketRef).then(resolve, reject).catch(reject)
    }, TIMEOUT_MS)

    const handlePong = (event: MessageEvent): void => {
      try {
        const msg = JSON.parse(String(event.data)) as unknown
        if (msg) {
          cleanup()
          resolve()
        }
      } catch {
        // not parseable, keep waiting
      }
    }

    const cleanup = (): void => {
      clearTimeout(timeout)
      socket.removeEventListener('message', handlePong)
    }

    socket.addEventListener('message', handlePong)
    socket.send(JSON.stringify({ type: 'ping' }))
  }).finally(() => {
    inFlightCheck = null
  })
  inFlightCheck = promise
  return promise
}
