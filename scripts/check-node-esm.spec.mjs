import { describe, expect, it } from 'vitest'

import { exportedSubpaths, isPeerFailure } from './check-node-esm.mjs'

describe('isPeerFailure', () => {
  it('tolerates a module of a peer that fails inside the peer', () => {
    expect(
      isPeerFailure(
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/r/node_modules/@linagora/twake-mui/dist/lib/makePalette' imported from /r/node_modules/@linagora/twake-mui/dist/index.js"
      )
    ).toBe(true)
  })

  it('fails a package that imports a missing file of a peer', () => {
    expect(
      isPeerFailure(
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/r/node_modules/@linagora/twake-mui/dist/lib/doesNotExist.js' imported from /r/packages/twake-sdk/dist/sdk.js"
      )
    ).toBe(false)
  })

  it('fails a package that imports its own file without extension', () => {
    expect(
      isPeerFailure(
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/r/packages/twake-bar/dist/TwakeBar' imported from /r/packages/twake-bar/dist/index.js"
      )
    ).toBe(false)
  })
})

describe('exportedSubpaths', () => {
  it('reads the subpaths of an exports map', () => {
    expect(exportedSubpaths({ '.': {}, './drive': {} })).toEqual([
      '.',
      './drive'
    ])
  })

  it('reads a string or top-level conditions as the package itself', () => {
    expect(exportedSubpaths('./dist/index.js')).toEqual(['.'])
    expect(
      exportedSubpaths({
        types: './dist/index.d.ts',
        import: './dist/index.js'
      })
    ).toEqual(['.'])
    expect(exportedSubpaths(undefined)).toEqual(['.'])
  })
})
