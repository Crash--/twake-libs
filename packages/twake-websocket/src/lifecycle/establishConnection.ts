import type { KyInstance } from 'ky'

import { buildWebSocketUrl } from '../api/buildUrl.js'
import { fetchWebSocketTicket } from '../api/fetchTicket.js'
import { createWebSocketConnection } from '../connection/createConnection.js'
import {
  WebSocketCallbacks,
  WebSocketWithCleanup
} from '../connection/types.js'

export async function establishWebSocketConnection(
  baseUrl: string,
  api: KyInstance,
  callbacks: WebSocketCallbacks,
  socketRef: React.MutableRefObject<WebSocketWithCleanup | null>,
  setIsSocketOpen: (value: boolean) => void,
  signal?: AbortSignal,
  ticketUrl?: string
): Promise<void> {
  try {
    const ticket = await fetchWebSocketTicket(api, ticketUrl)
    const url = buildWebSocketUrl(baseUrl, ticket.value)
    const socket = await createWebSocketConnection({ url, callbacks })

    if (signal?.aborted) {
      socket.cleanup()
      socket.close()
      return
    }

    socketRef.current = socket

    if (socket.readyState === WebSocket.OPEN) {
      setIsSocketOpen(true)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create WebSocket connection:', error)
    setIsSocketOpen(false)
  }
}
