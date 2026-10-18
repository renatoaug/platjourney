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
