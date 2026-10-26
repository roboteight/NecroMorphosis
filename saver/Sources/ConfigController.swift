import AppKit

/// Native settings sheet shown in System Settings → Screen Saver → Options.
final class ConfigController: NSObject {
    let window: NSWindow
    private let definition = ConfigDefinition.shared
    private var config: SaverConfig
    private var sliders: [String: NSSlider] = [:]
    private var valueLabels: [String: NSTextField] = [:]
    private let presetPopup = NSPopUpButton()
    private let noteLabel = NSTextField(wrappingLabelWithString: "")
    private let qualityPopup = NSPopUpButton()
    private let modePopup = NSPopUpButton()
    private let cycleField = NSTextField(string: "2")
    private let cycleStepper = NSStepper()
    private let cycleLabel = NSTextField(labelWithString: "minutes per preset")

    override init() {
        config = SaverConfig.load(.shared)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 520, height: 640),
                          styleMask: [.titled], backing: .buffered, defer: false)
        super.init()
        build()
        refresh()
    }

    private func build() {
        presetPopup.addItems(withTitles: definition.presets.map(\.name))
        presetPopup.target = self
        presetPopup.action = #selector(presetChanged)
        noteLabel.textColor = .secondaryLabelColor
        noteLabel.font = .systemFont(ofSize: 11)

        modePopup.addItems(withTitles: ["Use the settings below", "Random preset each time", "Cycle through all presets"])
        modePopup.target = self
        modePopup.action = #selector(modeChanged)
        cycleStepper.minValue = 1
        cycleStepper.maxValue = 60
        cycleStepper.target = self
        cycleStepper.action = #selector(cycleChanged)
        cycleField.isEditable = false
        cycleField.alignment = .right
        cycleField.widthAnchor.constraint(equalToConstant: 36).isActive = true
        let modeRow = NSStackView(views: [NSTextField(labelWithString: "Mode"), modePopup, cycleField, cycleStepper, cycleLabel])
        modeRow.spacing = 8
        let presetRow = NSStackView(views: [NSTextField(labelWithString: "Preset"), presetPopup])
        presetRow.spacing = 8

        let grid = NSStackView()
        grid.orientation = .vertical
        grid.alignment = .leading
        grid.spacing = 6
        let rows = definition.sliders + [SliderDef(key: "zoom", label: "View zoom (lower = closer)", min: 1.2, max: 8, step: 0.1)]
        for def in rows { grid.addArrangedSubview(row(for: def)) }

        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.borderType = .bezelBorder
        let flipped = FlippedView()
        flipped.translatesAutoresizingMaskIntoConstraints = false
        grid.translatesAutoresizingMaskIntoConstraints = false
        flipped.addSubview(grid)
        NSLayoutConstraint.activate([
            grid.topAnchor.constraint(equalTo: flipped.topAnchor, constant: 10),
            grid.bottomAnchor.constraint(equalTo: flipped.bottomAnchor, constant: -10),
            grid.leadingAnchor.constraint(equalTo: flipped.leadingAnchor, constant: 12),
            grid.trailingAnchor.constraint(equalTo: flipped.trailingAnchor, constant: -12),
        ])
        scroll.documentView = flipped
        flipped.widthAnchor.constraint(equalTo: scroll.contentView.widthAnchor).isActive = true

        qualityPopup.addItems(withTitles: ["Low (fastest)", "Medium", "High (sharpest)"])
        let qualityRow = NSStackView(views: [NSTextField(labelWithString: "Render quality"), qualityPopup])
        qualityRow.spacing = 12

        let reset = NSButton(title: "Reset to Preset", target: self, action: #selector(presetChanged))
        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancel))
        cancel.keyEquivalent = "\u{1b}"
        let ok = NSButton(title: "OK", target: self, action: #selector(ok))
        ok.keyEquivalent = "\r"
        let spacer = NSView()
        let buttons = NSStackView(views: [reset, spacer, cancel, ok])
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let root = NSStackView(views: [modeRow, presetRow, noteLabel, scroll, qualityRow, buttons])
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 10
        root.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        window.contentView = root
        for v in [scroll, buttons, noteLabel] as [NSView] {
            v.widthAnchor.constraint(equalTo: root.widthAnchor, constant: -32).isActive = true
        }
    }

    private func row(for def: SliderDef) -> NSView {
        let label = NSTextField(labelWithString: def.label)
        label.widthAnchor.constraint(equalToConstant: 170).isActive = true
        let slider = NSSlider(value: def.min, minValue: def.min, maxValue: def.max, target: self, action: #selector(sliderChanged(_:)))
        slider.identifier = NSUserInterfaceItemIdentifier(def.key)
        if def.step >= 1 {
            slider.numberOfTickMarks = Int((def.max - def.min) / def.step) + 1
            slider.allowsTickMarkValuesOnly = true
        }
        slider.widthAnchor.constraint(greaterThanOrEqualToConstant: 200).isActive = true
        let value = NSTextField(labelWithString: "")
        value.alignment = .right
        value.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        value.widthAnchor.constraint(equalToConstant: 44).isActive = true
        sliders[def.key] = slider
        valueLabels[def.key] = value
        let stack = NSStackView(views: [label, slider, value])
        stack.spacing = 8
        return stack
    }

    /// Pushes the current config into the controls.
    private func refresh() {
        presetPopup.selectItem(at: config.presetIndex)
        noteLabel.stringValue = definition.presets[config.presetIndex].note
        for (key, slider) in sliders {
            let v = config.values[key] ?? slider.minValue
            slider.doubleValue = v
            valueLabels[key]?.stringValue = Self.format(v)
        }
        qualityPopup.selectItem(at: ["low", "med", "high"].firstIndex(of: config.quality) ?? 1)
        modePopup.selectItem(at: Self.modes.firstIndex(of: config.mode) ?? 0)
        cycleStepper.integerValue = config.cycleMinutes
        cycleField.integerValue = config.cycleMinutes
        updateEnabled()
    }

    private static let modes = ["fixed", "random", "cycle"]

    /// Presets override the sliders in random and cycle modes; zoom always applies.
    private func updateEnabled() {
        let fixed = config.mode == "fixed"
        presetPopup.isEnabled = fixed
        for (key, slider) in sliders where key != "zoom" { slider.isEnabled = fixed }
        let cycling = config.mode == "cycle"
        cycleField.isHidden = !cycling
        cycleStepper.isHidden = !cycling
        cycleLabel.isHidden = !cycling
    }

    @objc private func modeChanged() {
        config.mode = Self.modes[modePopup.indexOfSelectedItem]
        updateEnabled()
    }

    @objc private func cycleChanged() {
        config.cycleMinutes = cycleStepper.integerValue
        cycleField.integerValue = config.cycleMinutes
    }

    private static func format(_ v: Double) -> String {
        String(format: "%.2f", v).replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression)
    }

    @objc private func presetChanged() {
        config.presetIndex = presetPopup.indexOfSelectedItem
        let zoom = config.values["zoom"]
        config.values = definition.presets[config.presetIndex].settings
        config.values["zoom"] = zoom
        refresh()
    }

    @objc private func sliderChanged(_ sender: NSSlider) {
        guard let key = sender.identifier?.rawValue else { return }
        let def = definition.sliders.first { $0.key == key }
        let step = def?.step ?? 0.1
        let v = (sender.doubleValue / step).rounded() * step
        config.values[key] = v
        valueLabels[key]?.stringValue = Self.format(v)
    }

    @objc private func ok() {
        config.quality = ["low", "med", "high"][qualityPopup.indexOfSelectedItem]
        config.save()
        close()
    }

    @objc private func cancel() { close() }

    private func close() {
        window.sheetParent?.endSheet(window)
    }
}

private final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}
