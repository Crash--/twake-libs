import {
  authorize,
  currentPath,
  exchangeCode,
  getAuthConfig,
  isLoginRequired,
  LoginRequiredError,
  type LoginResult
} from './oidc'

export type SignInResult = Omit<LoginResult, 'returnTo'>

const CALLBACK = 'twake-oidc:sso-callback'
const SILENT_TIMEOUT_MS = 10_000
const CLOSED_POLL_MS = 500

const silentName = (): string => `${getAuthConfig().clientId}-silent-sign-in`
const popupName = (): string => `${getAuthConfig().clientId}-sign-in`

/**
 * Hands the SSO's answer to the page that opened this window, when it is the
 * hidden frame of signInSilently or the popup of signInWithPopup. Call it
 * first on the page the answer reaches, and render nothing when it is true.
 */
export function relayCallback(): boolean {
  const to =
    window.name === silentName()
      ? window.parent
      : window.name === popupName()
        ? (window.opener as Window | null)
        : null
  // A tab keeps its name across navigations: one that is not, or no longer,
  // that frame or popup boots the app
  if (!to || to === window) return false
  to.postMessage(
    { type: CALLBACK, url: window.location.href },
    window.location.origin
  )
  return true
}

function answerFrom(
  source: () => Window | null,
  { timeoutMs, closed }: { timeoutMs?: number; closed?: () => boolean }
): Promise<URL> {
  return new Promise<URL>((resolve, reject) => {
    const fail = (reason: string): void => {
      done()
      reject(new Error(reason))
    }
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => fail('no answer from the SSO'), timeoutMs)
    // A window the user closes sends no message
    const poll =
      closed &&
      setInterval(() => {
        if (closed()) fail('popup closed')
      }, CLOSED_POLL_MS)
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.origin !== window.location.origin ||
        event.source === null ||
        event.source !== source()
      ) {
        return
      }
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (data?.type !== CALLBACK || typeof data.url !== 'string') return
      done()
      resolve(new URL(data.url))
    }
    const done = (): void => {
      clearTimeout(timer)
      clearInterval(poll)
      window.removeEventListener('message', onMessage)
    }
    window.addEventListener('message', onMessage)
  })
}

async function signInAt(
  open: (url: URL) => () => Window | null,
  options: { silent: boolean; timeoutMs?: number; closed?: () => boolean }
): Promise<SignInResult> {
  const authorization = await authorize(options.silent)
  const answer = await answerFrom(open(authorization.url), options)
  const error = answer.searchParams.get('error')
  if (error && answer.searchParams.get('state') === authorization.state) {
    if (isLoginRequired(error)) throw new LoginRequiredError(currentPath())
    throw new Error(error)
  }
  return exchangeCode(answer, authorization)
}

/**
 * Signs in without leaving the page, through a hidden frame that asks the SSO
 * to show nothing (`prompt=none`): it succeeds while the SSO session lasts.
 *
 * @throws LoginRequiredError when the SSO needs the user to sign in.
 */
export async function signInSilently(): Promise<SignInResult> {
  const frame = document.createElement('iframe')
  frame.name = silentName()
  frame.hidden = true
  try {
    return await signInAt(
      url => {
        frame.src = url.href
        document.body.append(frame)
        return () => frame.contentWindow
      },
      { silent: true, timeoutMs: SILENT_TIMEOUT_MS }
    )
  } finally {
    frame.remove()
  }
}

/**
 * Signs in through a popup where the SSO may show its portal, for a page the
 * SSO refuses to be shown in (a frame). Call it from a click handler: the
 * popup opens before anything else, while the browser still allows it.
 */
export function signInWithPopup(): Promise<SignInResult> {
  const popup = window.open('', popupName(), 'popup,width=480,height=640')
  if (!popup) return Promise.reject(new Error('popup blocked'))
  return signInAt(
    url => {
      popup.location.href = url.href
      return () => popup
    },
    { silent: false, closed: () => popup.closed }
  ).finally(() => {
    popup.close()
  })
}
