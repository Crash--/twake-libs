import '@testing-library/jest-dom/vitest'

// MUI useMediaQuery needs matchMedia: nothing matches, so tests run as desktop
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false
})
