import React, { createContext, useContext, useState } from 'react'

import {
  Dialog,
  IconButton,
  Popover,
  styled,
  useBreakpoints
} from '@linagora/twake-mui'

export interface BarMenuProps {
  /** Content of the button opening the menu */
  trigger: React.ReactNode
  label: string
  disabled?: boolean
  /** Menu content, given a function closing the menu */
  children: (close: () => void) => React.ReactNode
  'data-testid'?: string
}

/** Where the menus open on desktop: under their button, or beside it in the rail */
export const BarMenuPlacement = createContext<'below' | 'beside'>('below')

const PAPER_RADIUS = 14

const POPOVER_ORIGINS = {
  below: {
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: -10, horizontal: 0 }
  },
  beside: {
    anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
    transformOrigin: { vertical: 'bottom', horizontal: -10 }
  }
} as const

// Same vertical padding as the Menu list of cozy-bar
const Content = styled('div')({ padding: '8px 0' })

/**
 * A popover anchored to its button on desktop, a dialog on mobile. The
 * content brings its own list semantics (grid, MenuList).
 */
export const BarMenu = ({
  trigger,
  label,
  disabled,
  children,
  'data-testid': testId
}: BarMenuProps): React.ReactElement => {
  const [isOpen, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const { isMobile } = useBreakpoints()
  const placement = useContext(BarMenuPlacement)

  const handleOpen = (): void => setOpen(true)
  const handleClose = (): void => setOpen(false)

  return (
    <nav>
      <IconButton
        ref={setAnchor}
        onClick={handleOpen}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid={testId}
      >
        {trigger}
      </IconButton>
      {isMobile ? (
        <Dialog
          open={isOpen}
          onClose={handleClose}
          size="small"
          slotProps={{ paper: { sx: { borderRadius: `${PAPER_RADIUS}px` } } }}
        >
          {isOpen && <Content>{children(handleClose)}</Content>}
        </Dialog>
      ) : (
        <Popover
          open={isOpen}
          anchorEl={anchor}
          onClose={handleClose}
          {...POPOVER_ORIGINS[placement]}
          slotProps={{ paper: { sx: { borderRadius: `${PAPER_RADIUS}px` } } }}
        >
          <Content>{children(handleClose)}</Content>
        </Popover>
      )}
    </nav>
  )
}
