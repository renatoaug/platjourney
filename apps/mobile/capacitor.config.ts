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
  // The launch screen (Nexo) stays until the page's own boot screen is drawn (lib/native.ts hides
  // it), then fades into it; the long duration only covers a page that never loads.
  plugins: {
    SplashScreen: {
      launchShowDuration: 6000,
      launchFadeOutDuration: 200,
      backgroundColor: '#10120f',
      showSpinner: false,
    },
  },
}

export default config
