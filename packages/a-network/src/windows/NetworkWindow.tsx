import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { NetworkWidget } from "../widgets/NetworkWidget"
import type { NetworkWidgetConfig } from "../types"
import { getNetworkService } from "../services/networkService"
import { getNetworkConfigPath, resolveNetworkConfig } from "../config"

export function NetworkWindow(monitor = 0, cfg: NetworkWidgetConfig = {}) {
  const computeAnchor = (next: NetworkWidgetConfig) => {
    const raw = next.layout?.anchor
    const tokens = raw ? raw.split("|").map(t => t.trim().toUpperCase()).filter(Boolean) : []
    let mask = 0
    for (const token of tokens) {
      if (token === "TOP") mask |= Astal.WindowAnchor.TOP
      if (token === "BOTTOM") mask |= Astal.WindowAnchor.BOTTOM
      if (token === "LEFT") mask |= Astal.WindowAnchor.LEFT
      if (token === "RIGHT") mask |= Astal.WindowAnchor.RIGHT
    }
    return mask || (Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.RIGHT)
  }

  const computeAlign = (next: NetworkWidgetConfig) => {
    const anchor = computeAnchor(next)
    const valign = (anchor & Astal.WindowAnchor.TOP) && !(anchor & Astal.WindowAnchor.BOTTOM)
      ? Gtk.Align.START
      : (anchor & Astal.WindowAnchor.BOTTOM) && !(anchor & Astal.WindowAnchor.TOP)
        ? Gtk.Align.END
        : Gtk.Align.CENTER
    const halign = (anchor & Astal.WindowAnchor.LEFT) && !(anchor & Astal.WindowAnchor.RIGHT)
      ? Gtk.Align.START
      : (anchor & Astal.WindowAnchor.RIGHT) && !(anchor & Astal.WindowAnchor.LEFT)
        ? Gtk.Align.END
        : Gtk.Align.CENTER
    return { valign, halign }
  }

  let hideWindow = () => { }
  let innerRef: Gtk.Widget | null = null
  const buildInner = (next: NetworkWidgetConfig) => {
    const innerClass = next.windowLess ? "a-network-window-inner a-network-windowless-inner" : "a-network-window-inner"
    const marginCss = next.layout?.margin ? `margin: ${next.layout.margin};` : undefined
    const { valign, halign } = computeAlign(next)
    const inner = (
      <box
        class={innerClass}
        orientation={Gtk.Orientation.VERTICAL}
        css={marginCss}
      >
        {NetworkWidget(next)}
      </box>
    ) as Gtk.Box
    inner.set_halign(halign)
    inner.set_valign(valign)
    innerRef = inner

    const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    outer.set_hexpand(true)
    outer.set_vexpand(true)
    outer.set_halign(Gtk.Align.FILL)
    outer.set_valign(Gtk.Align.FILL)
    outer.append(inner)
    return outer
  }

  let currentConfig = resolveNetworkConfig(cfg)
  let currentWindowLess = Boolean(currentConfig.windowLess)
  const windowClass = currentConfig.windowLess ? "a-network-window a-network-windowless-window" : "a-network-window"
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
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      onShow={() => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
          getNetworkService().refresh().catch(err => console.error("a-network refresh error", err))
          return GLib.SOURCE_REMOVE
        })
      }}
    >
      {buildInner(currentConfig)}
    </window>
  ) as Astal.Window

  hideWindow = () => win.hide()

  const click = new Gtk.GestureClick()
  click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  click.connect("pressed", (gesture, _nPress, x, y) => {
    const inner = innerRef
    if (!inner) return
    const alloc = inner.get_allocation()
    const inside = x >= alloc.x && x <= alloc.x + alloc.width && y >= alloc.y && y <= alloc.y + alloc.height
    if (!inside) {
      win.hide()
      gesture.set_state(Gtk.EventSequenceState.CLAIMED)
    }
  })
  win.add_controller(click)

  const applyConfig = (next: NetworkWidgetConfig) => {
    currentConfig = next
    const child = buildInner(next)
    win.set_child(child)
    const wantWindowLess = Boolean(next.windowLess)
    if (wantWindowLess !== currentWindowLess) {
      (win as any).setWindowLess?.(wantWindowLess)
    }
  }

  const configPath = getNetworkConfigPath()
  let configMonitor: Gio.FileMonitor | null = null
  let reloadTimer: number | null = null
  try {
    const file = Gio.File.new_for_path(configPath)
    configMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null)
    configMonitor.connect("changed", () => {
      if (reloadTimer) GLib.source_remove(reloadTimer)
      reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
        reloadTimer = null
        applyConfig(resolveNetworkConfig(cfg))
        return GLib.SOURCE_REMOVE
      })
    })
  } catch (err) {
    console.error("a-network config monitor error", err)
  }

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
      const outer = win.get_first_child() as Gtk.Widget | null
      const inner = outer?.get_first_child() as Gtk.Widget | null
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
