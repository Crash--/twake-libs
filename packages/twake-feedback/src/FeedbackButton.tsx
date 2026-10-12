import { Comment, Icon } from '@linagora/twake-icons'
import { Fab, Menu, MenuItem, Tooltip, styled } from '@linagora/twake-mui'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useI18n } from 'twake-i18n'

import { getFeedbackButtonStrings, getFeedbackLabels } from './locales'
import {
  DRAG_THRESHOLD,
  EDGE_MARGIN,
  FAB_SIZE,
  clampBottom,
  getDefaultPosition,
  readPosition,
  snapToEdge,
  writePosition,
  type FeedbackPosition,
  type FeedbackSide
} from './position'
import { useFormInset } from './useFormInset'

/** Time in ms a finger must stay still on the button to open its menu */
const LONG_PRESS_DELAY = 500

export interface FeedbackButtonProps {
  /**
   * Plugs the feedback form on the button: called with the button element,
   * returns the function detaching it. Memoize it (`useCallback`) on what it
   * depends on, such as the language: a new function detaches the previous
   * one, which removes the form if it is open.
   */
  attach: (el: HTMLElement) => () => void
  /** Suffix of the `twake-feedback:` localStorage key keeping the position */
  storageKey: string
  /** Extra px kept free at the bottom, for instance for a mobile bottom bar */
  bottomOffset?: number
  /** Called with the side of the button on mount and when it changes */
  onSideChange?: (side: FeedbackSide) => void
  /** CSP nonce of the style element placing the form next to the button */
  styleNonce?: string
}

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  originLeft: number
  originTop: number
  /** The width depends on the label */
  width: number
  moved: boolean
  longPressed: boolean
  drop: { left: number; top: number } | null
  timer: ReturnType<typeof setTimeout> | null
}

const clampRange = (value: number, max: number): number =>
  Math.max(0, Math.min(value, max))

const StyledFab = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  // Above dialogs and drawers so a problem met in one can be reported from
  // there, below snackbars and tooltips
  zIndex: theme.zIndex.modal + 1,
  gap: theme.spacing(1),
  textTransform: 'none',
  whiteSpace: 'nowrap',
  // Lets pointer events drag the button instead of scrolling the page
  touchAction: 'none',
  userSelect: 'none',
  cursor: 'grab',
  '&:active': { cursor: 'grabbing' }
}))

export const FeedbackButton = ({
  attach,
  storageKey,
  bottomOffset = 0,
  onSideChange,
  styleNonce
}: FeedbackButtonProps): React.ReactElement => {
  const { lang } = useI18n()
  const strings = getFeedbackButtonStrings(lang)
  const { triggerLabel, triggerAriaLabel } = getFeedbackLabels(lang)

  // State rather than a ref: the effects and the menu need the mounted element
  const [button, setButton] = useState<HTMLButtonElement | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const clickBlockedRef = useRef(false)

  const [stored, setStored] = useState<FeedbackPosition>(
    () => readPosition(storageKey) ?? getDefaultPosition(bottomOffset)
  )
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight)
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Re-clamped on every render, so a restored or resized position stays visible
  const position: FeedbackPosition = {
    side: stored.side,
    bottom: clampBottom(stored.bottom, viewportHeight, bottomOffset)
  }

  useFormInset(position, styleNonce)

  const onSideChangeRef = useRef(onSideChange)
  useEffect(() => {
    onSideChangeRef.current = onSideChange
  })
  useEffect(() => {
    onSideChangeRef.current?.(stored.side)
  }, [stored.side])

  useEffect(() => {
    const onResize = (): void => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return (): void => window.removeEventListener('resize', onResize)
  }, [])

  // Registered before `attach` does, and in the capture phase: a click ending
  // a drag never reaches the listener opening the form
  useEffect(() => {
    if (!button) return undefined
    const onClick = (event: MouseEvent): void => {
      if (!clickBlockedRef.current) return
      clickBlockedRef.current = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    button.addEventListener('click', onClick, true)
    return (): void => button.removeEventListener('click', onClick, true)
  }, [button])

  useEffect(() => {
    return button ? attach(button) : undefined
  }, [button, attach])

  const clearTimer = (gesture: Gesture): void => {
    if (gesture.timer) clearTimeout(gesture.timer)
    gesture.timer = null
  }

  const endGesture = (gesture: Gesture): void => {
    clearTimer(gesture)
    gestureRef.current = null
    if (gesture.moved || gesture.longPressed) {
      // The click following the release comes in the same task
      clickBlockedRef.current = true
      setTimeout(() => {
        clickBlockedRef.current = false
      }, 0)
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const gesture: Gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      moved: false,
      longPressed: false,
      drop: null,
      timer: null
    }
    if (event.pointerType === 'touch') {
      gesture.timer = setTimeout(() => {
        gesture.timer = null
        gesture.longPressed = true
        setMenuOpen(true)
      }, LONG_PRESS_DELAY)
    }
    gestureRef.current = gesture
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>): void => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    gesture.moved = true
    clearTimer(gesture)
    gesture.drop = {
      left: clampRange(
        gesture.originLeft + dx,
        window.innerWidth - gesture.width
      ),
      top: clampRange(gesture.originTop + dy, window.innerHeight - FAB_SIZE)
    }
    setDrag(gesture.drop)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>): void => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (gesture.moved && gesture.drop) {
      const next = snapToEdge(
        gesture.drop,
        { width: window.innerWidth, height: window.innerHeight },
        bottomOffset,
        gesture.width
      )
      setStored(next)
      writePosition(storageKey, next)
    }
    setDrag(null)
    endGesture(gesture)
  }

  const handlePointerCancel = (
    event: React.PointerEvent<HTMLElement>
  ): void => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    setDrag(null)
    endGesture(gesture)
  }

  const openMenu = (event: React.SyntheticEvent): void => {
    event.preventDefault()
    setMenuOpen(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (
      event.key === 'ContextMenu' ||
      (event.shiftKey && event.key === 'F10')
    ) {
      openMenu(event)
    }
  }

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const moveTo = (side: FeedbackSide): void => {
    const next = { side, bottom: position.bottom }
    setStored(next)
    writePosition(storageKey, next)
    closeMenu()
  }

  const reset = (): void => {
    setStored(getDefaultPosition(bottomOffset))
    writePosition(storageKey, null)
    closeMenu()
  }

  // The coordinates are dynamic, a class per value would pile up in the page
  const placement: React.CSSProperties = drag
    ? { left: drag.left, top: drag.top }
    : {
        bottom: position.bottom,
        [position.side]: EDGE_MARGIN
      }

  return (
    <>
      {/* The visible label names the button, the tooltip describes it */}
      <Tooltip
        title={triggerAriaLabel}
        describeChild
        disableHoverListener={drag !== null}
      >
        <StyledFab
          ref={setButton}
          color="primary"
          variant="extended"
          aria-haspopup="menu"
          aria-keyshortcuts="Shift+F10"
          data-testid="twake-feedback-button"
          style={placement}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={openMenu}
          onKeyDown={handleKeyDown}
        >
          <Icon icon={Comment} size="24" />
          {triggerLabel}
        </StyledFab>
      </Tooltip>
      <Menu
        anchorEl={button}
        open={menuOpen}
        onClose={closeMenu}
        sx={{ zIndex: theme => theme.zIndex.modal + 2 }}
        slotProps={{
          list: {
            'aria-label': strings.menuLabel
          }
        }}
        data-testid="twake-feedback-menu"
      >
        <MenuItem
          disabled={position.side === 'left'}
          onClick={(): void => moveTo('left')}
        >
          {strings.moveLeft}
        </MenuItem>
        <MenuItem
          disabled={position.side === 'right'}
          onClick={(): void => moveTo('right')}
        >
          {strings.moveRight}
        </MenuItem>
        <MenuItem onClick={reset}>{strings.reset}</MenuItem>
      </Menu>
    </>
  )
}
