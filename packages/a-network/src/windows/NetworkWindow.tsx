import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import { NetworkWidget } from "../widgets/NetworkWidget"
import type { NetworkWidgetConfig } from "../types"
import { getNetworkService } from "../services/networkService"

export function NetworkWindow(monitor = 0, cfg: NetworkWidgetConfig = {}) {
  const windowClass = cfg.windowLess ? "a-network-window a-network-windowless-window" : "a-network-window"
  const innerClass = cfg.windowLess ? "a-network-window-inner a-network-windowless-inner" : "a-network-window-inner"
  let currentWindowLess = Boolean(cfg.windowLess)
  const win = (
    <window
      name="a-network"
      namespace="adart-a-network"
      class={windowClass}
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        // Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      onShow={() => {
        getNetworkService().refresh().catch(err => console.error("a-network refresh error", err))
      }}
    >
      <box
        class={innerClass}
        orientation={Gtk.Orientation.VERTICAL}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      >
        {NetworkWidget(cfg)}
      </box>
    </window>
  ) as Astal.Window

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_ctrl, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.hide()
      return true
    }
    return false
  })
  win.add_controller(key)

    ; (win as any).setWindowLess = (enabled: boolean) => {
      currentWindowLess = Boolean(enabled)
      const nextWindow = currentWindowLess ? "a-network-window a-network-windowless-window" : "a-network-window"
      const nextInner = currentWindowLess ? "a-network-window-inner a-network-windowless-inner" : "a-network-window-inner"
      win.set_css_classes(nextWindow.split(" "))
      const inner = win.get_first_child() as Gtk.Widget | null
      if (inner) {
        inner.set_css_classes(nextInner.split(" "))
        const root = inner.get_first_child() as Gtk.Widget | null
        if (root) {
          if (currentWindowLess) {
            root.add_css_class("a-network-windowless")
          } else {
            root.remove_css_class("a-network-windowless")
          }
        }
      }
    }

  return win
}
