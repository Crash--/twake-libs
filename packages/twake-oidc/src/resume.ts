import { signInSilently, type SignInResult } from './frame'
import {
  completeLogin,
  isFramed,
  isOnRedirectUri,
  LoginRequiredError,
  startLogin
} from './oidc'

/**
 * Signs the user in when the application starts: finishes the sign-in the SSO
 * answers on the redirect URI, or reuses the SSO session through a hidden
 * frame, or else sends the user to the SSO.
 *
 * @returns null when the user is sent to the SSO.
 * @throws LoginRequiredError framed, when the SSO needs the user: the page
 * around the frame signs them in.
 */
export async function resumeSession(): Promise<SignInResult | null> {
  if (isOnRedirectUri()) {
    const login = await completeLogin()
    if (login) {
      window.history.replaceState(null, '', login.returnTo)
      return login
    }
  } else {
    try {
      return await signInSilently()
    } catch (error) {
      // Framed, the SSO would refuse the same sign-in again
      if (isFramed() && error instanceof LoginRequiredError) throw error
    }
  }
  await startLogin()
  return null
}
