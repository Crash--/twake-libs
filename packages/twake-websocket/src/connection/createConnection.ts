import { WS_EVENTS } from '../protocols.js'
import { CreateConnectionOptions, WebSocketWithCleanup } from './types.js'

export async function createWebSocketConnection(
  options: CreateConnectionOptions
): Promise<WebSocketWithCleanup> {
  const { url, callbacks, connectionTimeoutMs = 10_000 } = options

  const socket = new WebSocket(url)

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.removeEventListener(WS_EVENTS.CONNECTION_OPENED, openHandler)
      socket.removeEventListener(WS_EVENTS.ERROR, errorHandler)
      socket.close()
      reject(new Error('WebSocket connection timed out'))
    }, connectionTimeoutMs)

    const openHandler = (): void => {
      // eslint-disable-next-line no-console
      console.info('WebSocket connection opened')
      clearTimeout(timeoutId)
      socket.removeEventListener(WS_EVENTS.CONNECTION_OPENED, openHandler)
      socket.removeEventListener(WS_EVENTS.ERROR, errorHandler)
      resolve()
    }

    const errorHandler = (error: Event): void => {
      // eslint-disable-next-line no-console
      console.error('WebSocket connection failed:', error)
      clearTimeout(timeoutId)
      socket.removeEventListener(WS_EVENTS.CONNECTION_OPENED, openHandler)
      socket.removeEventListener(WS_EVENTS.ERROR, errorHandler)
      reject(new Error('WebSocket connection failed'))
    }

    socket.addEventListener(WS_EVENTS.CONNECTION_OPENED, openHandler)
    socket.addEventListener(WS_EVENTS.ERROR, errorHandler)
  })

  // Store references to event handlers so they can be cleaned up later
  const messageHandler = (event: MessageEvent): void => {
    try {
      const message = JSON.parse(String(event.data)) as unknown
      callbacks.onMessage(message)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  const closeHandler = (event: CloseEvent): void => {
    // eslint-disable-next-line no-console
    console.info('WebSocket closed:', event.code, event.reason)
    cleanup()
    callbacks.onClose?.(event)
  }

  const errorHandler = (error: Event): void => {
    // eslint-disable-next-line no-console
    console.error('WebSocket error:', error)
    callbacks.onError?.(error)
  }

  // Cleanup function to remove all event listeners
  const cleanup = (): void => {
    socket.removeEventListener(WS_EVENTS.MESSAGE, messageHandler)
    socket.removeEventListener(WS_EVENTS.CONNECTION_CLOSED, closeHandler)
    socket.removeEventListener(WS_EVENTS.ERROR, errorHandler)
  }

  socket.addEventListener(WS_EVENTS.MESSAGE, messageHandler)
  socket.addEventListener(WS_EVENTS.CONNECTION_CLOSED, closeHandler)
  socket.addEventListener(WS_EVENTS.ERROR, errorHandler)

  // Attach cleanup method to socket
  const socketWithCleanup = socket as WebSocketWithCleanup
  socketWithCleanup.cleanup = cleanup

  return socketWithCleanup
}
