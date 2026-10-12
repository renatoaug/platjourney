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
  // The launch screen shows briefly, then fades into the app's own boot screen (Nexo pressing the
  // controller's buttons), which stays until the first data arrives.
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchFadeOutDuration: 300,
      backgroundColor: '#10120f',
      showSpinner: false,
    },
  },
}

export default config
