import React from 'react'

import { Box, Typography } from '@linagora/twake-mui'

type Block = { list: string[] } | { text: string }

/**
 * Splits notes into blocks: consecutive `- ` lines make one list, any other
 * non-empty line is a text block
 */
export const parseNotes = (notes: string): Block[] => {
  const blocks: Block[] = []
  for (const line of notes.split('\n')) {
    const last = blocks[blocks.length - 1]
    if (line.startsWith('- ')) {
      if (last !== undefined && 'list' in last) last.list.push(line.slice(2))
      else blocks.push({ list: [line.slice(2)] })
    } else if (line.trim() !== '') {
      blocks.push({ text: line })
    }
  }
  return blocks
}

/**
 * The patch notes of the offered build, in the one scrolling zone of the
 * dialog (past 60vh). It takes the focus with Tab so the keyboard can scroll
 * it, and is named by the dialog title.
 * Used by: NewVersionDialog
 */
export const PatchNotes = ({
  notes,
  titleId
}: {
  notes: string
  titleId: string
}): React.ReactElement => (
  <Box
    role="region"
    aria-labelledby={titleId}
    tabIndex={0}
    sx={{ maxHeight: '60vh', overflowY: 'auto' }}
  >
    {parseNotes(notes).map((block, i) =>
      'list' in block ? (
        <Box component="ul" key={i} sx={{ my: 1, pl: 3 }}>
          {block.list.map((item, j) => (
            <li key={j}>
              <Typography variant="body1" component="span">
                {item}
              </Typography>
            </li>
          ))}
        </Box>
      ) : (
        <Typography key={i} variant="body1">
          {block.text}
        </Typography>
      )
    )}
  </Box>
)
