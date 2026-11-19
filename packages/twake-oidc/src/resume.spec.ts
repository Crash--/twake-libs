import { beforeEach, expect, it, vi } from 'vitest'

import * as frame from './frame'
import * as oidc from './oidc'
import { resumeSession } from './resume'
import { setUpBrowser } from './testUtils'

const signedIn = {
  tokenSet: { access_token: 'token' },
  userinfo: { sub: 'alice' }
} as frame.SignInResult

beforeEach(() => {
  vi.restoreAllMocks()
})

it('finishes the sign-in on the redirect URI, then goes back', async () => {
  setUpBrowser('https://app.example.com/callback?code=c&state=state')
  const replaceState = vi.fn()
  Object.assign(window, { history: { replaceState } })
  vi.spyOn(oidc, 'completeLogin').mockResolvedValue({
    ...signedIn,
    returnTo: '/contacts/42'
  })

  await expect(resumeSession()).resolves.toMatchObject(signedIn)
  expect(replaceState).toHaveBeenCalledWith(null, '', '/contacts/42')
})

it('reuses the SSO session elsewhere', async () => {
  const { assign } = setUpBrowser('https://app.example.com/contacts')
  vi.spyOn(frame, 'signInSilently').mockResolvedValue(signedIn)

  await expect(resumeSession()).resolves.toBe(signedIn)
  expect(assign).not.toHaveBeenCalled()
})

it('sends the user to the SSO when there is no session to reuse', async () => {
  setUpBrowser('https://app.example.com/contacts')
  vi.spyOn(frame, 'signInSilently').mockRejectedValue(
    new oidc.LoginRequiredError('/contacts')
  )
  const startLogin = vi.spyOn(oidc, 'startLogin').mockResolvedValue()

  await expect(resumeSession()).resolves.toBeNull()
  expect(startLogin).toHaveBeenCalledOnce()
})

it('framed, leaves the sign-in to the page around the frame', async () => {
  setUpBrowser('https://app.example.com/embed/contacts', { framed: true })
  vi.spyOn(frame, 'signInSilently').mockRejectedValue(
    new oidc.LoginRequiredError('/embed/contacts')
  )
  const startLogin = vi.spyOn(oidc, 'startLogin').mockResolvedValue()

  await expect(resumeSession()).rejects.toBeInstanceOf(oidc.LoginRequiredError)
  expect(startLogin).not.toHaveBeenCalled()
})
