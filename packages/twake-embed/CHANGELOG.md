## @linagora/twake-embed [3.7.1](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.7.0...@linagora/twake-embed@3.7.1) (2026-11-18)


### Bug Fixes

* Publish with npm provenance ([913c37d](https://github.com/linagora/twake-libs/commit/913c37db3fd78ab56f981607213c29fe15b930a0))

# @linagora/twake-embed [3.7.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.6.0...@linagora/twake-embed@3.7.0) (2026-10-27)


### Features

* **twake-embed:** Let TwakeSpace send picked files to an app's resource ([b945bab](https://github.com/linagora/twake-libs/commit/b945bab7d470d1813a715194dc3ece915f980dc9))

# @linagora/twake-embed [3.6.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.5.0...@linagora/twake-embed@3.6.0) (2026-10-13)


### Features

* **twake-embed:** Open the links leaving the frame in a new tab ([c9dc3f0](https://github.com/linagora/twake-libs/commit/c9dc3f0b7ae492daaba8b86e65a458e2c5f58b65))

# @linagora/twake-embed [3.5.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.4.0...@linagora/twake-embed@3.5.0) (2026-10-08)


### Features

* **twake-embed:** Say which resource a notification is about ([1c25864](https://github.com/linagora/twake-libs/commit/1c258646ba156444c5e99f95ebae28d8739c3542))

# @linagora/twake-embed [3.4.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.3.0...@linagora/twake-embed@3.4.0) (2026-10-08)


### Features

* **twake-embed:** Report the metadata of an app's resources ([43b517a](https://github.com/linagora/twake-libs/commit/43b517ac8c0dcaabf16b052132de2ced130e75d4))

# @linagora/twake-embed [3.3.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.2.0...@linagora/twake-embed@3.3.0) (2026-10-08)


### Features

* **twake-embed:** Let an app open a call in the window of TwakeSpace ([1a899b0](https://github.com/linagora/twake-libs/commit/1a899b0ce971b4154f4c95d5661564409e872ba3))

# @linagora/twake-embed [3.2.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.1.0...@linagora/twake-embed@3.2.0) (2026-10-08)


### Features

* **twake-embed:** Ask TwakeSpace to show a notification for the app ([e6998b3](https://github.com/linagora/twake-libs/commit/e6998b370338f99eadcb655523aceff931b1d35e))

# @linagora/twake-embed [3.1.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@3.0.0...@linagora/twake-embed@3.1.0) (2026-10-08)


### Features

* **twake-embed:** Read the embed route from the hash for hash routers ([87ccb23](https://github.com/linagora/twake-libs/commit/87ccb2317ded6e2ccc96fd38adb192d8de3ba660))

# @linagora/twake-embed [3.0.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.1.0...@linagora/twake-embed@3.0.0) (2026-10-08)


* feat(twake-embed)!: Drop the theme message ([7d834eb](https://github.com/linagora/twake-libs/commit/7d834eb108ac73d6009a7b6c33755abb1b432540)), closes [twake-space#272](https://github.com/twake-space/issues/272)


### BREAKING CHANGES

* `THEME_MESSAGE`, `ThemeMessage` and `themeMessage` are
gone, and `parseHostMessage` no longer reads `twake-space:theme`.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

# @linagora/twake-embed [2.1.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.0.1...@linagora/twake-embed@2.1.0) (2026-10-07)


### Features

* **twake-embed:** Report the counts of an app for the tabs of TwakeSpace ([232b0c9](https://github.com/linagora/twake-libs/commit/232b0c9fc4b3dabc4bcc43decf29a0a0e98ea391))

## @linagora/twake-embed [2.0.1](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.0.0...@linagora/twake-embed@2.0.1) (2026-10-07)


### Bug Fixes

* **twake-embed:** Ask TwakeSpace for its greeting when the app boots late ([#14](https://github.com/linagora/twake-libs/issues/14)) ([4492645](https://github.com/linagora/twake-libs/commit/44926455210e4a10097e999a3a36ef0d34b6f02b))

# @linagora/twake-embed [2.0.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@1.1.0...@linagora/twake-embed@2.0.0) (2026-10-07)


* feat(twake-embed)!: Learn the host from its greeting, leave the overlay to twake-mui ([#11](https://github.com/linagora/twake-libs/issues/11)) ([16dc511](https://github.com/linagora/twake-libs/commit/16dc511156f8f1979eb74676282cb619d0dc0678))


### BREAKING CHANGES

* `connectSpaceOverlay`, `computeOverlayRegion`,
`SpaceOverlay` and `SpaceOverlayStatus` are gone, take them from
@linagora/twake-mui. An app that gives no `hostOrigins` posts nothing until
TwakeSpace greets it, so TwakeSpace sends `helloMessage()` on each load of
a frame first.

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

# @linagora/twake-embed [1.1.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@1.0.0...@linagora/twake-embed@1.1.0) (2026-10-07)


### Bug Fixes

* **twake-embed:** Refuse a double slash or a backslash in a path ([38b5065](https://github.com/linagora/twake-libs/commit/38b5065f017604971ecc5fda1900f1bf2f9587a2))
* **twake-embed:** Resolve the package under Jest without a module mapper ([625caff](https://github.com/linagora/twake-libs/commit/625caff35c380579b44d1f6b3cf9e5aa9fa6f677))


### Features

* **twake-embed:** Let an app ask TwakeSpace for the whole page ([f9f3fee](https://github.com/linagora/twake-libs/commit/f9f3fee17364267c11d059a04680da9daa3fe3a6))
* **twake-embed:** Name the whole page of TwakeSpace, not the full screen ([c67f1c5](https://github.com/linagora/twake-libs/commit/c67f1c5d5b33a86431df2ebe0a9ba50638a19b23))
* **twake-embed:** Tell the browser's full screen from the page of TwakeSpace ([780326b](https://github.com/linagora/twake-libs/commit/780326b3eb327f40a0cce8f1534a94aa96d5b707))

# @linagora/twake-embed 1.0.0 (2026-10-07)


### Bug Fixes

* **twake-embed:** Connect on the callback page of the silent login too ([14aa929](https://github.com/linagora/twake-libs/commit/14aa92931fb2f8f285359b2cb7ce4251417671b1))


### Features

* **twake-embed:** Add the embed contract with TwakeSpace ([4bff16f](https://github.com/linagora/twake-libs/commit/4bff16f372a8d8e31191a4ebd8d09a76ddcea33e))
