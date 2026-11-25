import React, { type ReactElement } from 'react'

import {
  Drive,
  DriveText,
  Grid,
  Icon,
  List,
  TwakeText
} from '@linagora/twake-icons'
import { Box, Skeleton } from '@linagora/twake-mui'

/** Widths of the names, as different as real file names */
const NAME_WIDTHS = [180, 280, 220, 260, 200, 240, 170, 250, 210]

const ROOT_SX = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  bgcolor: 'background.paper'
} as const

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  p: '24px 32px 24px 24px',
  borderBottom: 1,
  borderColor: 'divider'
} as const

const TOOLBAR_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: 2,
  pt: 1.5,
  pb: 4,
  borderBottom: 1,
  borderColor: 'divider'
} as const

const GROUP_SX = { display: 'flex', alignItems: 'center', gap: 1 } as const

const PILL_SX = { borderRadius: 4 } as const

// The list and grid views, greyed as disabled buttons: nothing to click yet
const VIEW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  color: 'action.disabled'
} as const

// The date and the size at the end of the row
const DATE_SX = { ml: 'auto' } as const

const LIST_SX = { flex: 1, px: 2, py: 1 } as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  py: 2,
  borderBottom: 1,
  borderColor: 'divider'
} as const

export interface DrivePickerSkeletonProps {
  'data-testid'?: string
}

/**
 * The Twake Drive file picker while it loads, as Twake Calendar shows it
 * over the frame of the intent: the Twake Drive logotype, the toolbar (the
 * pills of the path, the list and grid views) and rows of files (name,
 * date, size). It fills its box and is hidden from assistive technologies:
 * the host says that the picker is loading.
 */
export function DrivePickerSkeleton({
  'data-testid': testId
}: DrivePickerSkeletonProps): ReactElement {
  return (
    <Box sx={ROOT_SX} aria-hidden="true" data-testid={testId}>
      <Box sx={HEADER_SX}>
        <Icon icon={Drive} size={32} />
        <Icon icon={TwakeText} width={84} height={28} />
        <Icon icon={DriveText} width={72} height={28} />
      </Box>
      <Box sx={TOOLBAR_SX}>
        <Box sx={GROUP_SX}>
          <Skeleton variant="rounded" width={48} height={28} sx={PILL_SX} />
          <Skeleton variant="rounded" width={64} height={28} sx={PILL_SX} />
          <Skeleton variant="rounded" width={80} height={28} sx={PILL_SX} />
        </Box>
        <Box sx={GROUP_SX}>
          <Box sx={VIEW_SX}>
            <Icon icon={List} size={20} />
          </Box>
          <Box sx={VIEW_SX}>
            <Icon icon={Grid} size={20} />
          </Box>
        </Box>
      </Box>
      <Box sx={LIST_SX}>
        {NAME_WIDTHS.map(width => (
          <Box key={width} sx={ROW_SX}>
            <Skeleton variant="rounded" width={width} height={14} />
            <Skeleton variant="rounded" width={60} height={14} sx={DATE_SX} />
            <Skeleton variant="rounded" width={36} height={14} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
