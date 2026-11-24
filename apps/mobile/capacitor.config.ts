import type { CapacitorConfig } from '@capacitor/cli'

// The native app is a shell around the web app. By default it opens the live site (MOBILE_URL),
// so sign-in cookies, the API and any plugins work exactly as in the browser and a web release
// reaches the app without a store update. Without MOBILE_URL it ships the built web app instead
// (apps/web/dist), for offline testing.
const url = process.env.MOBILE_URL

const config: CapacitorConfig = {
  appId: 'com.platjourney.app',
  appName: 'PlatJourney',
  webDir: '../web/dist',
  backgroundColor: '#10120f',
  ...(url ? { server: { url, cleartext: url.startsWith('http://') } } : {}),
  // The launch screen is only the background: the app draws the loading screen itself from the
  // first frame (MainViewController's BootCoverView on iOS), with the player's buddy, until the
  // page's own copy is on screen (lib/native.ts hides it). The plugin's cover is not needed.
  plugins: {
    // iOS otherwise receives foreground pushes silently, including Settings' test.
    PushNotifications: {
      presentationOptions: ['banner', 'list', 'sound'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchFadeOutDuration: 0,
      backgroundColor: '#10120f',
      showSpinner: false,
    },
  },
}

export default config
