# Mobile

PlatJourney reaches a phone two ways: installed from the browser (a progressive web app) or as a native app built with Capacitor from the same web code. Neither needs a second interface: both are the React app in `apps/web`.

## Installed from the browser

`apps/web/public/manifest.webmanifest` gives the app a name, icons and a full-screen window, so a phone can put it on the home screen. The first time a new player opens the app on a phone, before the introduction, a short guide shows how: Share then "Add to Home Screen" on an iPhone, the browser's own install prompt or its menu on Android. It shows once per device, never inside the installed app and never for the demo player (`components/install-guide.tsx`).

Phone fields use 16px text, so iOS does not zoom the page when one gets focus.

## Feeling like an app

What makes the web app behave like a native one, in the browser, the installed app and the native app alike:

| What | Where |
|---|---|
| A boot screen while the app starts: Nexo pressing the controller's four buttons, until the session and the first data arrive, then a fade | `components/boot-screen.tsx`, `app/app.tsx` |
| On a phone, a deeper screen slides in from the right, going back slides in from the left, and the menu's screens fade | `useArrival` in `app/shell.tsx`, `styles/page.css` |
| Holding something that can be tapped does not select its text or open the link preview, and it sinks a little under the finger | `styles/base.css` |
| The profile and a game's page show at once when seen before, and refresh in place | the app cache (`useApp().cache`) |
| Pulling down at the top refreshes the screen (installed and native app only: Safari has its own) | `components/pull-refresh.tsx` |

The page covers the whole screen (`viewport-fit=cover`); the app frame and the sign-in screen keep the status bar's height free with `env(safe-area-inset-top)`.

## Native app (Capacitor)

`apps/mobile` holds the Capacitor project: `capacitor.config.ts` and the generated `android/` and `ios/` projects, with icons and launch images made from `apps/mobile/assets` (regenerated with `npx @capacitor/assets generate --ios --android`). Android's launch screen is not generated: Android 12 and later draw it from `values/styles.xml` and older versions from `drawable/splash.xml`, both Nexo (`drawable-xxxhdpi/splash_nexo.png`) on the dark background, so delete the `splash.png` files the generator writes under `android/`.

| Step | Command |
|---|---|
| Build the web app and copy it into both projects | `bun run --cwd apps/mobile sync` |
| Open in Android Studio | `bun run --cwd apps/mobile android` |
| Open in Xcode | `bun run --cwd apps/mobile ios` |

Building for a store needs Xcode (iOS) or Android Studio (Android), a developer account in each store, and signing keys; none of that is in the repository.

### What the app loads

| `MOBILE_URL` | The app opens | Use it for |
|---|---|---|
| Set (an instance's address) | That instance, live | A real build: sign-in cookies, the API and the instance's plugins work as in the browser, and a web release reaches the app without a store update |
| Not set | The web build copied into the app (`apps/web/dist`) | Looking at the interface offline; the API is not reachable from it |

`MOBILE_URL` is read when `cap sync` runs, so set it before syncing.

### Native touches

| What | How |
|---|---|
| Launch screen | `@capacitor/splash-screen` shows Nexo on the dark background (`launchShowDuration` 6000 ms at most) until the page's boot screen is drawn, then `hideLaunchScreen` in `apps/web/src/lib/native.ts` fades it out in 200 ms |
| Back swipe | A swipe from the left edge goes back a screen, with the iPhone's own animation (`MainViewController.swift`) |
| Haptics | `@capacitor/haptics` gives a light tick on the menu, tab bars, switches and pull-to-refresh (`lib/native.ts`); in a browser it does nothing |

### Plugins

Plugins are part of the web build (`PLUGINS_WEB`, see [plugins](06-plugins.md)), so the native app gets the ones of the instance it opens. With `MOBILE_URL` set, that is the live instance: whatever plugins it was built with show in the app too, and changing them needs no new app. Without `MOBILE_URL`, the app carries the plugins of the web build made before `cap sync`.


### iOS notifications

The iOS shell includes `@capacitor/push-notifications`. Settings > Notifications requests permission only when the player enables this device. Its preference is local to the account on this installation. Both transports use `push_subscription`, distinguished by `transport=webpush|apns`; Web Push's existing registrations are preserved. The app registers on launch and foreground resume, receives a fresh APNs token from the OS and saves it through the authenticated `/api/push/native` route. A random installation secret lets token renewal update one row; the server supplies the account, session hash and APNs environment. Android remains on its existing behavior; no FCM configuration is included.

Delivery requires the registering session to still exist and be unexpired. Logout stops new delivery even if the browser cleanup fails; changing the password revokes devices on the other sessions. Turning off push removes the device, unregisters with iOS and clears delivered notifications. The app also clears delivered notifications on logout. An already delivered notification or an APNs request already in flight cannot be recalled; APNs expiration is zero to avoid storing new private notices for later delivery. APNs failures are isolated from Web Push and Telegram, without logging tokens or content. Invalid tokens are removed, temporary failures retained for future notices; there is no retry queue. A stable collapse id merges repeats of the same tip.

Each notice links to `/history?tip=tip%3A...`. Existing producers return text; delivery resolves the latest persisted tip with that exact content and owner. If lookup fails it safely opens the history. The selected tip is fetched separately, so it works beyond the first history page and ignores a remembered filter. The API always checks ownership; a deleted or other-account tip has a safe empty state. A native tap accepts only this internal route, stays at it through login, and adds `from=push` for the existing usage plugin.

### Local iOS check

Use `bun run --cwd apps/mobile sync:ios` to build and sync only iOS. For a real signed build, set `MOBILE_URL` to the reviewed HTTPS instance **before** syncing. The default offline bundle has no API and is not a beta release configuration. Do not commit an instance URL or generated `capacitor.config.json`.

```sh
xcodebuild -project apps/mobile/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath /tmp/platjourney-ios-build CODE_SIGNING_ALLOWED=NO build
```

The checked-in entitlements use `development` for Debug and `production` for Release. The server's `APNS_ENVIRONMENT=sandbox` is for a development-signed build; `production` is for TestFlight/distribution. Use separate instances for the two environments. The server pins the environment, rather than trusting a body field from the client. Set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (PEM, actual newlines or escaped `\n`) and `APNS_TOPIC=com.platjourney.app` only through the operator's secret configuration. Without all key fields, APNs stays off. The native app contains no APNs provider key.

### Before a beta can ship

- Active Apple Developer membership and App Store Connect access; confirm the Team ID.
- Confirm the bundle id `com.platjourney.app` is available and register the explicit App ID with Push Notifications. Creating identifiers, keys, certificates or provisioning profiles is a separately approved operator action.
- Obtain an APNs token-auth key authorized for this app/environment; keep its `.p8`, Key ID and Team ID in the private secret store. No credentials are created by sync or the unsigned build above.
- Select the correct signing team, certificate and provisioning profile. A device build requires its device registration/profile; TestFlight requires distribution signing. Do not enable automatic signing to generate credentials without approval.
- Recheck the 1024 px app icon, launch images, version/build number, privacy policy, app privacy declarations, encryption/export answers, support and beta feedback details. Supply a review account and working backend. The existing assets are retained.
- On an iPhone, verify allow/deny, foreground/background/terminated taps, token renewal, two accounts, logout, password revocation, disabled preferences, offline behavior and an old/missing tip. An unsigned simulator build and mocks do not verify APNs delivery.
- Billing is a separate release decision: review digital subscriptions/credits and external purchase links against the target storefront rules before submission. No prices, plans, checkout or purchase implementation changes are included here. Native push alone does not establish compliance with minimum-functionality review.
- Uploading to TestFlight, inviting testers and publishing require their own release approval. External testing may require beta review.

References: [Capacitor push plugin](https://capacitorjs.com/docs/apis/push-notifications), [APNs requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

The in-place database upgrade and the incompatibility with older senders are documented in [ADR-012](../decisions/ADR-012-ios-native-push.md#migration). The unified schema is migration `028_push_transport.surql`.
