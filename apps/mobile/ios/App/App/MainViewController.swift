import UIKit
import Capacitor

/// The app's web view, with the iPhone's own back gesture: a swipe from the left edge goes back a
/// screen, the same history the web app's links push.
class MainViewController: CAPBridgeViewController {
    static let launchBackground = UIColor(red: 16.0 / 255, green: 18.0 / 255, blue: 15.0 / 255, alpha: 1)

    private var bootCover: BootCoverView?
    private var loading: NSKeyValueObservation?

    override func capacitorDidLoad() {
        // Keep the window, bridge and transparent WebView on the same surface while the remote
        // page loads. The splash and the web boot screen use this same background.
        view.backgroundColor = Self.launchBackground
        webView?.isOpaque = false
        webView?.backgroundColor = Self.launchBackground
        webView?.scrollView.backgroundColor = Self.launchBackground
        webView?.allowsBackForwardNavigationGestures = true
        bridge?.registerPluginInstance(BootCoverPlugin())
        showBootCover()
    }

    /// The loading screen, drawn here from the first frame: the page's own boot screen, moving
    /// while the page loads behind it. The page hides it once its copy is on screen; a page that
    /// never loads cannot keep it forever.
    private func showBootCover() {
        let cover = BootCoverView(frame: view.bounds, buddy: BootCoverView.rememberedBuddy())
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(cover)
        bootCover = cover
        // A page that does not say when its copy is on screen (an older release) still lets go:
        // once the web view finishes loading, its own boot screen is already drawn.
        loading = webView?.observe(\.isLoading, options: [.new]) { [weak self] _, change in
            guard change.newValue == false else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { self?.hideBootCover() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in self?.hideBootCover() }
    }

    // The web view adds its own content views as the page loads: the cover stays on top of them.
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if let cover = bootCover {
            cover.frame = view.bounds
            view.bringSubviewToFront(cover)
        }
    }

    func hideBootCover() {
        guard let cover = bootCover else { return }
        bootCover = nil
        loading = nil
        UIView.animate(withDuration: 0.2, animations: { cover.alpha = 0 }, completion: { _ in
            cover.removeFromSuperview()
        })
    }
}

/// What the page tells the native side about the loading screen: that its own copy is on screen
/// (`hide`), and which buddy the player picked (`remember`), so the next launch shows it.
@objc(BootCoverPlugin)
public class BootCoverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BootCoverPlugin"
    public let jsName = "BootCover"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remember", returnType: CAPPluginReturnPromise)
    ]

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? MainViewController)?.hideBootCover()
            call.resolve()
        }
    }

    @objc func remember(_ call: CAPPluginCall) {
        let buddy = call.getString("buddy") ?? "nexo"
        // Only a name the app bundles a picture for: anything else shows Nexo.
        if UIImage(named: "buddy-\(buddy)") != nil {
            UserDefaults.standard.set(buddy, forKey: BootCoverView.buddyKey)
        }
        call.resolve()
    }
}

/// A native copy of the web app's boot screen (components/boot-screen.css): the name on top, the
/// buddy floating with the controller's four buttons pressed in turn around it, the bar running
/// through the trophy tiers and the first line.
final class BootCoverView: UIView {
    static let buddyKey = "platjourney.buddy"

    static func rememberedBuddy() -> String {
        UserDefaults.standard.string(forKey: buddyKey) ?? "nexo"
    }

    private static func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: alpha
        )
    }

    // The default look's tokens (styles/theme.css).
    private static let background = color(0x08130f)
    private static let accent = color(0xc2f366)
    private static let border = color(0x1d392d)
    private static let subtle = color(0x8aa99a)
    private static let foreground = color(0xf4fbf6)
    private static let tiers = [color(0xca9774), color(0xc3ced6), color(0xe6c47e), color(0xbad2e4)]

    private let wash = CAGradientLayer()
    private let stage = UIView()
    private let buddyView = UIImageView()
    private let bar = UIView()
    private let fill = CAGradientLayer()
    private let line = UILabel()
    private let brand = UIStackView()
    private var keys: [UIView] = []
    private let isObject: Bool

    init(frame: CGRect, buddy: String) {
        isObject = buddy != "nexo"
        super.init(frame: frame)
        backgroundColor = Self.background
        isUserInteractionEnabled = true

        wash.type = .radial
        wash.colors = [Self.accent.withAlphaComponent(0.08).cgColor, UIColor.clear.cgColor]
        wash.startPoint = CGPoint(x: 0.5, y: 0.5)
        wash.endPoint = CGPoint(x: 1, y: 1)
        layer.addSublayer(wash)

        let logo = UIImageView(image: UIImage(named: "boot-logo"))
        logo.contentMode = .scaleAspectFit
        logo.widthAnchor.constraint(equalToConstant: 28).isActive = true
        logo.heightAnchor.constraint(equalToConstant: 28).isActive = true
        let name = UILabel()
        let font = UIFont.systemFont(ofSize: 20, weight: .semibold)
        let text = NSMutableAttributedString(
            string: "plat", attributes: [.font: font, .foregroundColor: Self.foreground])
        text.append(NSAttributedString(
            string: "journey", attributes: [.font: font, .foregroundColor: Self.accent]))
        name.attributedText = text
        brand.axis = .horizontal
        brand.alignment = .center
        brand.spacing = 10
        brand.addArrangedSubview(logo)
        brand.addArrangedSubview(name)
        addSubview(brand)

        addSubview(stage)
        buddyView.image = UIImage(named: "buddy-\(buddy)") ?? UIImage(named: "buddy-nexo")
        buddyView.contentMode = .scaleAspectFit
        stage.addSubview(buddyView)
        for symbol in 0..<4 { keys.append(key(symbol)) }

        bar.backgroundColor = Self.border
        bar.layer.cornerRadius = 2
        bar.clipsToBounds = true
        fill.colors = Self.tiers.map(\.cgColor)
        fill.startPoint = CGPoint(x: 0, y: 0.5)
        fill.endPoint = CGPoint(x: 1, y: 0.5)
        fill.cornerRadius = 2
        bar.layer.addSublayer(fill)
        addSubview(bar)

        let pt = Locale.preferredLanguages.first?.hasPrefix("pt") ?? true
        line.attributedText = NSAttributedString(
            string: pt ? "LIGANDO O CONTROLE" : "TURNING ON THE CONTROLLER",
            attributes: [
                .font: UIFont.systemFont(ofSize: 11, weight: .medium),
                .foregroundColor: Self.subtle,
                .kern: 1.6
            ])
        addSubview(line)

        animate()
    }

    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    /// One of the controller's buttons: △ above, ○ right, × below, □ left.
    private func key(_ index: Int) -> UIView {
        let ring = UIView(frame: CGRect(x: 0, y: 0, width: 38, height: 38))
        ring.layer.cornerRadius = 19
        ring.layer.borderWidth = 1.5
        ring.layer.borderColor = Self.border.cgColor
        let shape = CAShapeLayer()
        let path = UIBezierPath()
        switch index {
        case 0:
            path.move(to: CGPoint(x: 10, y: 3))
            path.addLine(to: CGPoint(x: 17.5, y: 16))
            path.addLine(to: CGPoint(x: 2.5, y: 16))
            path.close()
        case 1:
            path.append(UIBezierPath(ovalIn: CGRect(x: 3, y: 3, width: 14, height: 14)))
        case 2:
            path.move(to: CGPoint(x: 4, y: 4))
            path.addLine(to: CGPoint(x: 16, y: 16))
            path.move(to: CGPoint(x: 16, y: 4))
            path.addLine(to: CGPoint(x: 4, y: 16))
        default:
            path.append(UIBezierPath(roundedRect: CGRect(x: 3.5, y: 3.5, width: 13, height: 13), cornerRadius: 1))
        }
        // The 20-unit drawing at 18 points, centred in the ring.
        path.apply(CGAffineTransform(scaleX: 0.9, y: 0.9))
        shape.path = path.cgPath
        shape.frame = CGRect(x: 10, y: 10, width: 18, height: 18)
        shape.fillColor = UIColor.clear.cgColor
        shape.strokeColor = Self.subtle.cgColor
        shape.lineWidth = 2
        shape.lineCap = .round
        shape.lineJoin = .round
        shape.name = "symbol"
        ring.layer.addSublayer(shape)
        stage.addSubview(ring)
        return ring
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        wash.frame = CGRect(x: bounds.midX - 300, y: bounds.midY - 210, width: 600, height: 420)
        // The page's column, centred: the stage, 26 points, the bar, 26 points, the line.
        let lineSize = line.intrinsicContentSize
        let total = 200 + 26 + 4 + 26 + lineSize.height
        var y = (bounds.height - total) / 2
        stage.frame = CGRect(x: bounds.midX - 100, y: y, width: 200, height: 200)
        y += 226
        bar.frame = CGRect(x: bounds.midX - 60, y: y, width: 120, height: 4)
        y += 30
        line.frame = CGRect(
            x: bounds.midX - lineSize.width / 2, y: y, width: lineSize.width, height: lineSize.height)
        let brandSize = brand.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
        brand.frame = CGRect(
            x: bounds.midX - brandSize.width / 2, y: 40, width: brandSize.width, height: brandSize.height)
        buddyView.bounds = CGRect(x: 0, y: 0, width: 108, height: 108)
        buddyView.center = CGPoint(x: 100, y: 100)
        let spots = [CGPoint(x: 100, y: 19), CGPoint(x: 181, y: 100), CGPoint(x: 100, y: 181), CGPoint(x: 19, y: 100)]
        for (key, spot) in zip(keys, spots) { key.center = spot }
        fill.frame = CGRect(x: 0, y: 0, width: 48, height: 4)
    }

    private func animate() {
        guard !UIAccessibility.isReduceMotionEnabled else { return }
        let float = CABasicAnimation(keyPath: "transform.translation.y")
        float.fromValue = 0
        float.toValue = -6
        float.duration = 1.5
        float.autoreverses = true
        float.repeatCount = .infinity
        float.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        buddyView.layer.add(float, forKey: "float")
        if isObject {
            // An object breathes too, as it does in the app.
            let breathe = CABasicAnimation(keyPath: "transform.scale.y")
            breathe.fromValue = 1
            breathe.toValue = 0.98
            breathe.duration = 1.25
            breathe.autoreverses = true
            breathe.repeatCount = .infinity
            breathe.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            buddyView.layer.add(breathe, forKey: "breathe")
        }

        // Each button pressed in turn, a quarter of the cycle after the one before.
        let now = CACurrentMediaTime()
        for (index, key) in keys.enumerated() {
            let begin = now + Double(index) * 0.4
            let press = CAKeyframeAnimation(keyPath: "transform.scale")
            press.values = [1, 0.88, 1, 1]
            press.keyTimes = [0, 0.1, 0.3, 1]
            let lit = CAKeyframeAnimation(keyPath: "borderColor")
            lit.values = [Self.border.cgColor, Self.accent.cgColor, Self.border.cgColor, Self.border.cgColor]
            lit.keyTimes = press.keyTimes
            for animation in [press, lit] {
                animation.duration = 1.6
                animation.repeatCount = .infinity
                animation.beginTime = begin
            }
            key.layer.add(press, forKey: "press")
            key.layer.add(lit, forKey: "lit")
            if let symbol = key.layer.sublayers?.first(where: { $0.name == "symbol" }) {
                let stroke = CAKeyframeAnimation(keyPath: "strokeColor")
                stroke.values = [Self.subtle.cgColor, Self.accent.cgColor, Self.subtle.cgColor, Self.subtle.cgColor]
                stroke.keyTimes = press.keyTimes
                stroke.duration = 1.6
                stroke.repeatCount = .infinity
                stroke.beginTime = begin
                symbol.add(stroke, forKey: "stroke")
            }
        }

        // The bar runs through the tiers, from out of sight on the left to out on the right.
        let slide = CABasicAnimation(keyPath: "position.x")
        slide.fromValue = -24
        slide.toValue = 144
        slide.duration = 1.6
        slide.repeatCount = .infinity
        slide.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        fill.add(slide, forKey: "slide")
    }
}
