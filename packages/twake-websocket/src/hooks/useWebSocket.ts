import type { KyInstance } from 'ky'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  registerWebSocketState,
  WebSocketWithCleanup,
  WebSocketCallbacks
} from '../connection/index.js'
import {
  closeWebSocketConnection,
  establishWebSocketConnection,
  setupWebSocketPing,
  PingConfig
} from '../lifecycle/index.js'
import { useWebSocketReconnect } from './useReconnect.js'

export interface UseWebSocketOptions {
  /** Base URL for the WebSocket server (e.g. https://example.com or wss://example.com) */
  baseUrl: string
  /** ky instance for fetching the WebSocket ticket */
  api: KyInstance
  /** Optional custom ticket endpoint (default: 'ws/ticket') */
  ticketUrl?: string
  /** Whether the connection should be active */
  enabled?: boolean
  /** Called for every incoming message */
  onMessage: (data: unknown) => void
  /** Called when the connection closes */
  onClose?: (event: CloseEvent) => void
  /** Called on connection errors */
  onError?: (error: Event) => void
  /** Called when the connection successfully opens */
  onOpen?: () => void
  /** Timeout for the initial connection handshake */
  connectionTimeoutMs?: number
  /** Ping/pong configuration */
  pingConfig?: PingConfig
}

export interface UseWebSocketResult {
  /** The current WebSocket instance (null when closed) */
  socket: WebSocketWithCleanup | null
  /** Whether the socket is currently open */
  isOpen: boolean
  /** Whether a connection attempt is in progress */
  isConnecting: boolean
  /** Manually trigger a reconnect (resets attempt counter) */
  triggerReconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketResult {
  const {
    baseUrl,
    api,
    ticketUrl,
    enabled = true,
    onMessage,
    onClose,
    onError,
    onOpen,
    connectionTimeoutMs = 10_000,
    pingConfig
  } = options

  const socketRef = useRef<WebSocketWithCleanup | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pingCleanupRef = useRef<(() => void) | null>(null)
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didConnectTimeoutRef = useRef(false)
  const enabledRef = useRef(enabled)

  const [isSocketOpen, setIsSocketOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [shouldConnect, setShouldConnect] = useState(false)

  const { scheduleReconnect, clearReconnectTimeout } = useWebSocketReconnect(
    reconnectTimeoutRef,
    enabledRef,
    reconnectAttemptsRef,
    setShouldConnect
  )

  const handleMessage = useCallback(
    (data: unknown) => {
      onMessage(data)
    },
    [onMessage]
  )

  const handleClose = useCallback(
    (event: CloseEvent) => {
      socketRef.current = null
      setIsSocketOpen(false)

      if (event.code !== 1000 && event.code !== 1001) {
        // eslint-disable-next-line no-console
        console.warn(
          `WebSocket closed unexpectedly (code: ${event.code}, reason: ${event.reason || 'none'}). ` +
            `Attempting to reconnect...`
        )
        scheduleReconnect()
      } else {
        reconnectAttemptsRef.current = 0
        clearReconnectTimeout()
      }

      onClose?.(event)
    },
    [scheduleReconnect, clearReconnectTimeout, onClose]
  )

  const handleError = useCallback(
    (error: Event) => {
      // eslint-disable-next-line no-console
      console.error('WebSocket error:', error)
      onError?.(error)
    },
    [onError]
  )

  const callbacks = useMemo<WebSocketCallbacks>(
    () => ({
      onMessage: handleMessage,
      onClose: handleClose,
      onError: handleError
    }),
    [handleMessage, handleClose, handleError]
  )

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  // Reset reconnection state on successful connection
  useEffect(() => {
    if (isSocketOpen) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
      didConnectTimeoutRef.current = false
      reconnectAttemptsRef.current = 0
      clearReconnectTimeout()
      onOpen?.()
    }
  }, [isSocketOpen, clearReconnectTimeout, onOpen])

  // Manage WebSocket connection
  useEffect(() => {
    const abortController = new AbortController()

    const cleanup = (): void => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
      closeWebSocketConnection(socketRef, setIsSocketOpen)
      clearReconnectTimeout()
    }

    if (!enabled) {
      cleanup()
      reconnectAttemptsRef.current = 0
      return
    }

    const connect = async (): Promise<void> => {
      if (isConnectingRef.current || isSocketOpen) return
      isConnectingRef.current = true
      setIsConnecting(true)
      didConnectTimeoutRef.current = false
      connectTimeoutRef.current = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn('WebSocket connection attempt timed out')
        didConnectTimeoutRef.current = true
        abortController.abort()
        connectTimeoutRef.current = null
        isConnectingRef.current = false
        setIsConnecting(false)
        cleanup()
        scheduleReconnect()
      }, connectionTimeoutMs)

      try {
        await establishWebSocketConnection(
          baseUrl,
          api,
          callbacks,
          socketRef,
          setIsSocketOpen,
          abortController.signal,
          ticketUrl
        )
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('WebSocket establishment failed:', err)
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current)
          connectTimeoutRef.current = null
        }
        if (!didConnectTimeoutRef.current) {
          scheduleReconnect()
        }
      } finally {
        isConnectingRef.current = false
        setIsConnecting(false)
      }
    }

    void connect()

    return (): void => {
      abortController.abort()
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    callbacks,
    clearReconnectTimeout,
    shouldConnect,
    scheduleReconnect,
    connectionTimeoutMs,
    baseUrl,
    api,
    ticketUrl
  ])

  // Ping/pong health check
  useEffect(() => {
    if (!isSocketOpen || !socketRef.current) {
      if (pingCleanupRef.current) {
        pingCleanupRef.current()
        pingCleanupRef.current = null
      }
      return
    }

    const pingCleanup = setupWebSocketPing(socketRef.current, {
      ...pingConfig,
      onConnectionDead: () => {
        // eslint-disable-next-line no-console
        console.warn('WebSocket connection appears dead (no pong received)')
        if (socketRef.current) {
          socketRef.current.close()
        }
      },
      onPingFail: () => {
        // eslint-disable-next-line no-console
        console.warn('Failed to send ping')
      }
    })

    pingCleanupRef.current = pingCleanup.stop

    return (): void => {
      if (pingCleanupRef.current) {
        pingCleanupRef.current()
        pingCleanupRef.current = null
      }
    }
  }, [isSocketOpen, pingConfig])

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = (): void => {
      if (!isSocketOpen && enabledRef.current) {
        reconnectAttemptsRef.current = 0
        clearReconnectTimeout()
        setShouldConnect(prev => !prev)
      }
    }

    const handleOffline = (): void => {
      closeWebSocketConnection(socketRef, setIsSocketOpen)
      clearReconnectTimeout()
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return (): void => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isSocketOpen, clearReconnectTimeout])

  const triggerReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    clearReconnectTimeout()
    setShouldConnect(prev => !prev)
  }, [clearReconnectTimeout])

  useEffect(() => {
    registerWebSocketState(socketRef, triggerReconnect)
  }, [triggerReconnect])

  return {
    socket: socketRef.current,
    isOpen: isSocketOpen,
    isConnecting,
    triggerReconnect
  }
}
