import { Astal, Gtk } from "ags/gtk4"
import { createComputed, createEffect } from "ags"
import { osdState } from "../store" // your createState store
import { timeout } from "ags/time"
import Pango from "gi://Pango"


const FADE_MS = 200

export function OSDWindow(defaultMonitor = 0) {
  // Derived accessors (reactive)
  const monitor = createComputed(() => osdState().monitor ?? defaultMonitor)
  let winRef: Astal.Window | null = null
  let hideTimer: any = null

  const cardClass = createComputed(() => {
    const s = osdState()
    return `osd-card ${s.visible ? "osd-card-visible" : "osd-card-hidden"}`
  })

  const iconName = createComputed(() => osdState().icon)

  const title = createComputed(() => {
    const { kind, label, muted } = osdState()
    switch (kind) {
      case "volume":
        return muted ? `${label} (Muted)` : label
      case "mic":
        return muted ? `${label} (Muted)` : label
      default:
        return label
    }
  })

  const valueText = createComputed(() => {
    const v = osdState().value
    if (v === null || v === undefined) return ""
    return typeof v === "number" ? `${v}%` : String(v)
  })

  const showProgress = createComputed(() => {
    const s = osdState()
    return !!s.showProgress && typeof s.value === "number"
  })

  const progressValue = createComputed<number>(() => {
    const v = osdState().value
    return typeof v === "number" ? v : 0
  })
  // This is the "visible -> mapped" bridge.
  createEffect(() => {
    const s = osdState() // reactive dependency
    if (!winRef) return

    // Always keep monitor updated while visible
    winRef.monitor = s.monitor ?? defaultMonitor

    // Cancel pending hide if we get shown again quickly
    hideTimer?.cancel?.()
    hideTimer?.stop?.()
    hideTimer?.destroy?.()
    hideTimer = null

    if (s.visible) {
      // Map immediately so CSS can fade in
      winRef.visible = true
    } else {
      // Let CSS fade out, then unmap
      hideTimer = timeout(FADE_MS, () => {
        if (winRef) winRef.visible = false
        hideTimer = null
      })
    }
  })

  return (
    <window
      name="osd"
      namespace="adart-osd"
      class="osd-window"
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      focusable={false}
      // Start unmapped; we map when state.visible becomes true
      visible={false}
      anchor={Astal.WindowAnchor.BOTTOM}
      monitor={monitor}
      $={(self: Astal.Window) => {
        winRef = self
      }}    >
      <box
        class={cardClass}
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.END}
      >
        <box class="osd-card-header"
          halign={Gtk.Align.FILL}
          hexpand={true}
          valign={Gtk.Align.CENTER}>
          <image class="osd-card-icon" pixelSize={96} icon_name={iconName} />

          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={2}
            hexpand={true}
            halign={Gtk.Align.CENTER}
          >
            <label class="osd-card-label" label={title}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={20}
              singleLineMode={true}
            />
            <label class="osd-card-value" label={valueText} />
          </box>
        </box>

        <Gtk.LevelBar
          class="osd-card-progress"
          mode={Gtk.LevelBarMode.CONTINUOUS}
          minValue={0}
          maxValue={100}
          visible={showProgress}
          value={progressValue}
        />
      </box>
    </window>
  ) as Astal.Window
}
