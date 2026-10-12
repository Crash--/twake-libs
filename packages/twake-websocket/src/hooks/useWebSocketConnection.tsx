import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'

import {
  WebSocketWithCleanup,
  registerWebSocketState,
  setWebSocketConnecting
} from '../connection'
import {
  PingCleanup,
  closeWebSocketConnection,
  establishWebSocketConnection,
  setupWebSocketPing
} from '../lifecycle'
import { useWebSocketReconnect } from './useReconnect'

type EstablishParams = Parameters<typeof establishWebSocketConnection>
export type WebSocketUrl = EstablishParams[0]
export type WebSocketApi = EstablishParams[1]

export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

export interface UseWebSocketConnectionOptions {
  /** Replaces `isAuthenticated`: connect while true, tear down when false. */
  enabled: boolean
  /** Replaces `window.WEBSOCKET_URL ?? window.CALENDAR_BASE_URL`. */
  url: WebSocketUrl
  /** Replaces the app-specific `api` client used to get the ws ticket. */
  api: WebSocketApi
  /** Receives every raw message. Identity may change freely. */
  onMessage: (message: unknown) => void
  /** Called whenever the socket is torn down (disabled, offline, unmount...). */
  onDisconnect?: () => void
  connectTimeoutMs?: number
  /** Exposes the socket as `window.__ws` for debugging. */
  exposeOnWindow?: boolean
}

export interface WebSocketConnection {
  socketRef: React.MutableRefObject<WebSocketWithCleanup | null>
  isOpen: boolean
  /** Incremented on every successful (re)connection. */
  epoch: number
  /** Last socket error, raw. Translate at render time. */
  error: Event | null
  clearError: () => void
  /** Reset backoff and force a new connection attempt. */
  reconnect: () => void
}

export function useWebSocketConnection({
  enabled,
  url,
  api,
  onMessage,
  onDisconnect,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
  exposeOnWindow = false
}: UseWebSocketConnectionOptions): WebSocketConnection {
  const socketRef = useRef<WebSocketWithCleanup | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const pingCleanupRef = useRef<PingCleanup | null>(null)
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didConnectTimeoutRef = useRef(false)

  const [isOpen, setIsOpenState] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [error, setError] = useState<Event | null>(null)
  const [shouldConnect, setShouldConnect] = useState(false)

  const isOpenRef = useRef(false)
  const enabledRef = useRef(enabled)
  const onMessageRef = useRef(onMessage)
  const onDisconnectRef = useRef(onDisconnect)

  useEffect(() => {
    enabledRef.current = enabled
    onMessageRef.current = onMessage
    onDisconnectRef.current = onDisconnect
  })

  // Same shape as a state setter (the lib helpers expect that), but bumps the
  // epoch in the same batch as `isOpen`, so consumers never see one without the other.
  const setIsSocketOpen: Dispatch<SetStateAction<boolean>> = useCallback(
    value => {
      const next =
        typeof value === 'function' ? value(isOpenRef.current) : value
      if (next && !isOpenRef.current) setEpoch(previous => previous + 1)
      isOpenRef.current = next
      setIsOpenState(next)
    },
    []
  )

  const { scheduleReconnect, clearReconnectTimeout } = useWebSocketReconnect(
    reconnectTimeoutRef,
    enabledRef,
    reconnectAttemptsRef,
    setShouldConnect
  )

  const clearConnectTimeout = useCallback((): void => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }, [])

  const onClose = useCallback(
    (event: CloseEvent) => {
      // Socket already cleaned up by the internal handler before this fires
      socketRef.current = null
      setIsSocketOpen(false)

      // 1000 = normal closure, 1001 = going away (e.g. page unload)
      if (event.code !== 1000 && event.code !== 1001) {
        scheduleReconnect()
      } else {
        reconnectAttemptsRef.current = 0
        clearReconnectTimeout()
      }
    },
    [scheduleReconnect, clearReconnectTimeout, setIsSocketOpen]
  )

  const onError = useCallback((event: Event) => {
    setError(event)
  }, [])

  const callbacks = useMemo(
    () => ({
      onMessage: (message: unknown): void => onMessageRef.current(message),
      onClose,
      onError
    }),
    [onClose, onError]
  )

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    clearReconnectTimeout()
    setShouldConnect(previous => !previous)
  }, [clearReconnectTimeout])

  // Reset backoff on successful connection
  useEffect(() => {
    if (!isOpen) return
    clearConnectTimeout()
    didConnectTimeoutRef.current = false
    reconnectAttemptsRef.current = 0
    clearReconnectTimeout()
  }, [isOpen, clearConnectTimeout, clearReconnectTimeout])

  // Connection lifecycle
  useEffect(() => {
    const abortController = new AbortController()

    const cleanup = (): void => {
      clearConnectTimeout()
      closeWebSocketConnection(socketRef, setIsSocketOpen)
      if (exposeOnWindow) {
        delete (window as unknown as { __ws?: unknown }).__ws
      }
      clearReconnectTimeout()
      onDisconnectRef.current?.()
    }

    if (!enabled) {
      cleanup()
      reconnectAttemptsRef.current = 0
      return
    }

    const connect = async (): Promise<void> => {
      if (isConnectingRef.current || isOpenRef.current) return
      isConnectingRef.current = true
      setWebSocketConnecting(true)
      didConnectTimeoutRef.current = false
      connectTimeoutRef.current = setTimeout(() => {
        didConnectTimeoutRef.current = true
        abortController.abort()
        connectTimeoutRef.current = null
        isConnectingRef.current = false
        setWebSocketConnecting(false)
        cleanup()
        scheduleReconnect()
      }, connectTimeoutMs)

      try {
        await establishWebSocketConnection(
          url,
          api,
          callbacks,
          socketRef,
          setIsSocketOpen,
          abortController.signal
        )
        if (exposeOnWindow && socketRef.current) {
          ;(window as unknown as { __ws?: unknown }).__ws = socketRef.current
        }
      } catch (_err) {
        clearConnectTimeout()
        // Only reconnect if the timeout handler hasn't already done so
        if (!didConnectTimeoutRef.current) scheduleReconnect()
      } finally {
        isConnectingRef.current = false
        setWebSocketConnecting(false)
      }
    }

    void connect()

    return (): void => {
      abortController.abort()
      cleanup()
    }
  }, [
    enabled,
    url,
    api,
    callbacks,
    shouldConnect,
    connectTimeoutMs,
    exposeOnWindow,
    scheduleReconnect,
    clearReconnectTimeout,
    clearConnectTimeout,
    setIsSocketOpen
  ])

  // Browser online/offline
  useEffect(() => {
    const handleOnline = (): void => {
      if (!isOpenRef.current && enabledRef.current) reconnect()
    }
    const handleOffline = (): void => {
      closeWebSocketConnection(socketRef, setIsSocketOpen)
      clearReconnectTimeout()
      clearConnectTimeout()
      onDisconnectRef.current?.()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return (): void => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [reconnect, clearReconnectTimeout, clearConnectTimeout, setIsSocketOpen])

  // Ping / dead-connection detection
  useEffect(() => {
    if (!isOpen || !socketRef.current) {
      pingCleanupRef.current?.stop()
      pingCleanupRef.current = null
      return
    }

    pingCleanupRef.current = setupWebSocketPing(socketRef.current, {
      onConnectionDead: () => {
        socketRef.current?.close() // triggers onClose -> scheduleReconnect
      },
      onPingFail: () => {}
    })

    return (): void => {
      pingCleanupRef.current?.stop()
      pingCleanupRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    registerWebSocketState(socketRef, reconnect)
  }, [reconnect])

  const clearError = useCallback(() => setError(null), [])

  return { socketRef, isOpen, epoch, error, clearError, reconnect }
}
