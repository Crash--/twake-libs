import { WebSocketWithCleanup } from '../connection/types.js'

export function closeWebSocketConnection(
  socketRef: React.MutableRefObject<WebSocketWithCleanup | null>,
  setIsSocketOpen: (value: boolean) => void
): void {
  if (socketRef.current) {
    socketRef.current.cleanup()
    socketRef.current.close()
    socketRef.current = null
    setIsSocketOpen(false)
  }
}
