import { define } from 'rstack'
import fmt from 'rslint-config-cozy-app/fmt'
import react from 'rslint-config-cozy-app/react'

define.lint(lint => react(lint))

define.fmt({
  ...fmt,
  // Written by semantic-release
  ignorePatterns: ['CHANGELOG.md']
})
