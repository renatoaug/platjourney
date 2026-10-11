# Mobile

PlatJourney reaches a phone two ways: installed from the browser (a progressive web app) or as a native app built with Capacitor from the same web code. Neither needs a second interface: both are the React app in `apps/web`.

## Installed from the browser

`apps/web/public/manifest.webmanifest` gives the app a name, icons and a full-screen window, so a phone can put it on the home screen. The first time a new player opens the app on a phone, before the introduction, a short guide shows how: Share then "Add to Home Screen" on an iPhone, the browser's own install prompt or its menu on Android. It shows once per device, never inside the installed app and never for the demo player (`components/install-guide.tsx`).

Phone fields use 16px text, so iOS does not zoom the page when one gets focus.

## Native app (Capacitor)

`apps/mobile` holds the Capacitor project: `capacitor.config.ts` and the generated `android/` and `ios/` projects, with icons and splash screens made from the logo (`apps/mobile/assets`, regenerated with `npx @capacitor/assets generate --ios --android`).

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

### Plugins

Plugins are part of the web build (`PLUGINS_WEB`, see [plugins](plugins.md)), so the native app gets the ones of the instance it opens. With `MOBILE_URL` set, that is the live instance: whatever plugins it was built with show in the app too, and changing them needs no new app. Without `MOBILE_URL`, the app carries the plugins of the web build made before `cap sync`.
