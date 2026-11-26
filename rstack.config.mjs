import { define } from 'rstack'
import fmt from 'rslint-config-cozy-app/fmt'
import nodeEsm from 'rslint-config-cozy-app/node-esm'
import react from 'rslint-config-cozy-app/react'

define.lint(lint => [...react(lint), ...nodeEsm()])

define.fmt({
  ...fmt,
  // Written by semantic-release
  ignorePatterns: ['CHANGELOG.md']
})
