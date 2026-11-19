# @linagora/twake-websocket

WebSocket management library for Twake applications.

## Features

- Connection lifecycle management with cleanup
- Automatic reconnection with exponential backoff
- Ping/pong health monitoring
- Browser online/offline awareness
- React hooks (`useWebSocket`, `useWebSocketReconnect`)
- Type-safe message handling

## Installation

```bash
npm install @linagora/twake-websocket
```

## Usage

### Low-level connection

```ts
import { createWebSocketConnection } from '@linagora/twake-websocket'

const socket = await createWebSocketConnection({
  url: 'wss://example.com/ws?ticket=abc',
  callbacks: {
    onMessage: data => console.log(data),
    onClose: event => console.log('closed', event),
    onError: error => console.error(error)
  }
})
```

### React hook

```ts
import { useWebSocket } from '@linagora/twake-websocket'

function MyComponent() {
  const { socket, isOpen, isConnecting, triggerReconnect } = useWebSocket({
    url: 'wss://example.com/ws?ticket=abc',
    enabled: isAuthenticated,
    onMessage: data => console.log(data)
  })

  // ...
}
```

## API

See the source `src/index.ts` for exported modules.
