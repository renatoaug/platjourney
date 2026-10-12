import UIKit
import Capacitor

/// The app's web view, with the iPhone's own back gesture: a swipe from the left edge goes back a
/// screen, the same history the web app's links push.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        webView?.allowsBackForwardNavigationGestures = true
    }
}
