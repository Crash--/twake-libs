/**
 * Resolves once the user goes to the page. A page prerendered by the browser
 * (Speculation Rules) runs before that: Chrome holds back its frames of other
 * origins, so a silent sign-in times out, and the sessionStorage written
 * before a redirect to the SSO is gone when it comes back (Chrome 156), so a
 * sign-in started there loops.
 */
export function waitForActivation(): Promise<void> {
  const page = globalThis.document as
    (Document & { prerendering?: boolean }) | undefined
  if (!page?.prerendering) return Promise.resolve()
  return new Promise(resolve => {
    page.addEventListener('prerenderingchange', () => resolve(), {
      once: true
    })
  })
}
