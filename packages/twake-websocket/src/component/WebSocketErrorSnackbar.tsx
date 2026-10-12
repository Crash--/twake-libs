import React from 'react'

import { WebSocketStatusSnackbar } from './WebSocketStatusSnackbar'

export interface WebSocketErrorSnackbarProps {
  error: Event | null
  onClose: () => void
  /** The app owns i18n: it turns the raw error into a message. */
  formatMessage: (error: Event) => string
}

export function WebSocketErrorSnackbar({
  error,
  onClose,
  formatMessage
}: WebSocketErrorSnackbarProps): JSX.Element | null {
  if (!error) return null
  return (
    <WebSocketStatusSnackbar
      message={formatMessage(error)}
      severity="error"
      onClose={onClose}
    />
  )
}
