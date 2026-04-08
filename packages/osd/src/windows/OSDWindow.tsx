import { Astal, Gtk } from "ags/gtk4"
import { createComputed, createEffect } from "ags"
import { timeout } from "ags/time"
import Pango from "gi://Pango"
import { osdState } from "../store"

export const OSD_WINDOW_NAME = "osd"

type TimerHandle = {
  cancel?(): void
  stop?(): void
  destroy?(): void
}

export type OSDWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
}

const FADE_MS = 200

export function OSDWindow(defaultMonitor = 0) {
  const monitor = createComputed(() => osdState().monitor ?? defaultMonitor)
  let winRef: Astal.Window | null = null
  let hideTimer: TimerHandle | null = null

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

  createEffect(() => {
    const s = osdState()
    if (!winRef) return

    winRef.monitor = s.monitor ?? defaultMonitor

    hideTimer?.cancel?.()
    hideTimer?.stop?.()
    hideTimer?.destroy?.()
    hideTimer = null

    if (s.visible) {
      winRef.visible = true
    } else {
      hideTimer = timeout(FADE_MS, () => {
        if (winRef) winRef.visible = false
        hideTimer = null
      })
    }
  })

  const win = (
    <window
      name={OSD_WINDOW_NAME}
      namespace="adart-osd"
      class="osd-window"
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      focusable={false}
      visible={false}
      anchor={Astal.WindowAnchor.BOTTOM}
      monitor={monitor}
      $={(self: Astal.Window) => {
        winRef = self
      }}
    >
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
  ) as OSDWindowHandle

  win.openWindow = () => {
    win.visible = true
  }

  win.closeWindow = () => {
    win.visible = false
  }

  return win
}
