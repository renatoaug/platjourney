import UIKit
import Capacitor

/// The app's web view, with the iPhone's own back gesture: a swipe from the left edge goes back a
/// screen, the same history the web app's links push.
class MainViewController: CAPBridgeViewController {
    static let launchBackground = UIColor(red: 16.0 / 255, green: 18.0 / 255, blue: 15.0 / 255, alpha: 1)

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleBillingPlugin())
        // Keep the window, bridge and transparent WebView on the same surface while the remote
        // page loads. The splash and the web boot screen use this same background.
        view.backgroundColor = Self.launchBackground
        webView?.isOpaque = false
        webView?.backgroundColor = Self.launchBackground
        webView?.scrollView.backgroundColor = Self.launchBackground
        webView?.allowsBackForwardNavigationGestures = true
    }
}
