import ScreenSaver
import WebKit
import os

let log = Logger(subsystem: "NecroMorphosis", category: "saver")

final class LogHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        log.notice("web: \(String(describing: message.body), privacy: .public)")
    }
}

let moduleName = "com.simari.necromorphosis.saver"

/// Persisted saver configuration: slider values by key, plus zoom and quality.
struct SaverConfig {
    var values: [String: Double]
    var presetIndex: Int
    var quality: String
    /// "fixed" uses the sliders, "random" picks a preset per start, "cycle" rotates through them.
    var mode: String
    var cycleMinutes: Int

    static func load(_ definition: ConfigDefinition) -> SaverConfig {
        let d = ScreenSaverDefaults(forModuleWithName: moduleName)!
        var values = definition.presets[definition.defaultPreset].settings
        values["zoom"] = 3.2
        if let saved = d.dictionary(forKey: "values") as? [String: Double] {
            values.merge(saved) { _, new in new }
        }
        return SaverConfig(
            values: values,
            presetIndex: d.object(forKey: "preset") as? Int ?? definition.defaultPreset,
            quality: d.string(forKey: "quality") ?? "med",
            mode: d.string(forKey: "mode") ?? "fixed",
            cycleMinutes: d.object(forKey: "cycleMinutes") as? Int ?? 2)
    }

    func save() {
        let d = ScreenSaverDefaults(forModuleWithName: moduleName)!
        d.set(values, forKey: "values")
        d.set(presetIndex, forKey: "preset")
        d.set(quality, forKey: "quality")
        d.set(mode, forKey: "mode")
        d.set(cycleMinutes, forKey: "cycleMinutes")
        d.synchronize()
    }
}

struct SliderDef: Decodable {
    let key: String, label: String
    let min: Double, max: Double, step: Double
}

struct PresetDef: Decodable {
    let name: String, note: String
    let settings: [String: Double]
}

struct ConfigDefinition: Decodable {
    let sliders: [SliderDef]
    let presets: [PresetDef]
    let defaultPreset: Int

    static let shared: ConfigDefinition = {
        let bundle = Bundle(for: NecroMorphosisView.self)
        let url = bundle.url(forResource: "config", withExtension: "json")!
        return try! JSONDecoder().decode(ConfigDefinition.self, from: Data(contentsOf: url))
    }()
}

/// Serves the bundle's Resources folder to the web view.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "necromorph"

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let name = task.request.url?.lastPathComponent ?? "index.html"
        let url = Bundle(for: NecroMorphosisView.self).resourceURL!.appendingPathComponent(name)
        guard let data = try? Data(contentsOf: url) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = name.hasSuffix(".html") ? "text/html" : "application/octet-stream"
        task.didReceive(URLResponse(url: task.request.url!, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8"))
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

@objc(NecroMorphosisView)
final class NecroMorphosisView: ScreenSaverView {
    private var webView: WKWebView?
    private var configController: ConfigController?

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0 / 30
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func startAnimation() {
        super.startAnimation()
        guard webView == nil else { return }

        var config = SaverConfig.load(.shared)
        if isPreview { config.quality = "low" }
        var settings = config.values.filter { $0.key != "zoom" }
        var cycle: [String: Any]?
        let presets = ConfigDefinition.shared.presets
        let startIndex = Int.random(in: 0..<presets.count)
        if config.mode != "fixed" { settings = presets[startIndex].settings }
        if config.mode == "cycle" {
            cycle = ["presets": presets.map(\.settings), "start": startIndex, "seconds": config.cycleMinutes * 60]
        }
        var payload: [String: Any] = [
            "settings": settings,
            "zoom": config.values["zoom"] ?? 3.2,
            "quality": config.quality,
        ]
        if let cycle { payload["cycle"] = cycle }
        let json = String(data: try! JSONSerialization.data(withJSONObject: payload), encoding: .utf8)!

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(LogHandler(), name: "nm")
        configuration.userContentController.addUserScript(
            WKUserScript(source: "window.NM_CONFIG = \(json);", injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // The saver host sandbox blocks loadFileURL, so the page is served through a custom scheme.
        configuration.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        let web = WKWebView(frame: bounds, configuration: configuration)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        // The saver host's window reports as occluded, so WebKit would suspend the page and freeze
        // the animation. Opt this view out of occlusion detection (private API, so check first).
        let occlusion = Selector(("_setWindowOcclusionDetectionEnabled:"))
        if web.responds(to: occlusion), let imp = web.method(for: occlusion) {
            typealias SetBool = @convention(c) (AnyObject, Selector, Bool) -> Void
            unsafeBitCast(imp, to: SetBool.self)(web, occlusion, false)
            log.notice("occlusion detection disabled")
        } else {
            log.notice("occlusion detection selector unavailable")
        }
        addSubview(web)
        webView = web

        web.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!))
    }

    override func stopAnimation() {
        super.stopAnimation()
        webView?.removeFromSuperview()
        webView = nil
    }

    // The WebGL page animates itself; ScreenSaverView's own timer has nothing to draw.
    override func animateOneFrame() {}

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        let controller = ConfigController()
        configController = controller
        return controller.window
    }
}
