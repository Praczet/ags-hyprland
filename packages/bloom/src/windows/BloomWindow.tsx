import { Astal, Gtk } from "ags/gtk4"
import { createEffect } from "ags"
import { bloomVisible } from "../store"
import { BloomProgress } from "../widgets/BloomProgress"

export const BLOOM_WINDOW_NAME = "bloom"

export function BloomWindow(defaultMonitor = 0) {
  let winRef: Astal.Window | null = null

  createEffect(() => {
    if (!winRef) return
    winRef.visible = bloomVisible()
  })

  return (
    <window
      name={BLOOM_WINDOW_NAME}
      namespace="adart-bloom"
      class="bloom-window"
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      focusable={false}
      visible={false}
      anchor={Astal.WindowAnchor.TOP}
      marginTop={75}
      monitor={defaultMonitor}
      $={(self: Astal.Window) => { winRef = self }}
    >
      <box halign={Gtk.Align.CENTER} valign={Gtk.Align.START}>
        <BloomProgress />
      </box>
    </window>
  ) as Astal.Window
}
