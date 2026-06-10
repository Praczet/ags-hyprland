import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"

import { resolveLyricsConfig } from "../config"
import { getLyricsStore } from "../store"
import type { LyricsConfig } from "../types"
import { getLyricsVisiblePreference, setLyricsVisiblePreference } from "../visibility"
import { createLyricsView } from "../widgets/LyricsView"

export const LYRICS_WINDOW_NAME = "lyrics"

export type LyricsWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
}

function anchorFromConfig(position: ReturnType<typeof resolveLyricsConfig>["position"]) {
  let anchor = 0

  if (position.includes("top")) anchor |= Astal.WindowAnchor.TOP
  if (position.includes("bottom")) anchor |= Astal.WindowAnchor.BOTTOM
  if (position.includes("left")) anchor |= Astal.WindowAnchor.LEFT
  if (position.includes("right")) anchor |= Astal.WindowAnchor.RIGHT

  if (position.includes("center")) {
    if (!position.includes("left") && !position.includes("right")) {
      anchor |= Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT
    }
  }

  return anchor
}

export function LyricsWindow(defaultMonitor = 0, userConfig?: LyricsConfig) {
  const config = resolveLyricsConfig({ monitor: defaultMonitor, ...userConfig })
  const store = getLyricsStore(config)
  const view = createLyricsView(config)

  const frame = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    halign: config.position.includes("left")
      ? Gtk.Align.START
      : config.position.includes("right")
        ? Gtk.Align.END
        : Gtk.Align.CENTER,
    valign: config.position.includes("bottom") ? Gtk.Align.END : Gtk.Align.START,
    marginTop: config.marginTop,
    marginBottom: config.marginBottom,
    marginStart: config.marginLeft,
    marginEnd: config.marginRight,
  })
  frame.add_css_class("lyrics-window-frame")
  frame.append(view.root)

  const win = (
    <window
      name={LYRICS_WINDOW_NAME}
      namespace="adart-lyrics"
      class="lyrics-window"
      visible={false}
      monitor={config.monitor}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.NONE}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={anchorFromConfig(config.position)}
    >
      {frame}
    </window>
  ) as LyricsWindowHandle

  const unsubscribe = store.subscribe(state => view.render(state))
  view.render(store.get())

  win.openWindow = () => {
    setLyricsVisiblePreference(true)
    win.show()
    store.start()
    store.refresh()
  }

  win.closeWindow = () => {
    setLyricsVisiblePreference(false)
    win.hide()
    store.stop()
  }

  win.connect("destroy", () => {
    unsubscribe()
    store.stop()
  })

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.closeWindow()
      return true
    }
    return false
  })
  win.add_controller(key)

  if (getLyricsVisiblePreference()) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      win.openWindow()
      return GLib.SOURCE_REMOVE
    })
  }

  return win
}
