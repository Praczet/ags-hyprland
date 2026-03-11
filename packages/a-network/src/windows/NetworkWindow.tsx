import { createRoot } from "ags"
import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { NetworkWidget } from "../widgets/NetworkWidget"
import type { NetworkWidgetConfig } from "../types"
import { getNetworkService } from "../services/networkService"
import { getNetworkConfigPath, onNetworkConfigChange, resolveNetworkConfig } from "../config"

export function NetworkWindow(monitor = 0, cfg: NetworkWidgetConfig = {}) {
  const parseMargin = (value?: string) => {
    if (!value) return null
    const tokens = value.trim().split(/\s+/).filter(Boolean)
    const numbers = tokens.map(token => {
      const match = token.match(/^(-?\d+)(px)?$/)
      if (!match) return null
      return Number(match[1])
    })
    if (numbers.some(v => v === null)) return null
    const vals = numbers as number[]
    if (vals.length === 1) {
      return { top: vals[0], right: vals[0], bottom: vals[0], left: vals[0] }
    }
    if (vals.length === 2) {
      return { top: vals[0], right: vals[1], bottom: vals[0], left: vals[1] }
    }
    if (vals.length === 3) {
      return { top: vals[0], right: vals[1], bottom: vals[2], left: vals[1] }
    }
    if (vals.length >= 4) {
      return { top: vals[0], right: vals[1], bottom: vals[2], left: vals[3] }
    }
    return null
  }

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
  let currentDispose: (() => void) | null = null
  const buildInner = (next: NetworkWidgetConfig) => {
    if (currentDispose) {
      currentDispose()
      currentDispose = null
    }
    const innerClass = next.windowLess ? "a-network-window-inner a-network-windowless-inner" : "a-network-window-inner"
    const marginSpec = next.layout?.margin
    const margin = parseMargin(marginSpec)
    const marginCss = margin ? undefined : (marginSpec ? `margin: ${marginSpec};` : undefined)
    const { valign, halign } = computeAlign(next)
    const inner = (
      <box
        class={innerClass}
        orientation={Gtk.Orientation.VERTICAL}
        css={marginCss}
      >
      </box>
    ) as Gtk.Box
    const built = createRoot((dispose) => {
      const widget = NetworkWidget(next)
      return { widget, dispose }
    })
    currentDispose = built.dispose
    inner.append(built.widget)
    if (margin) {
      inner.set_margin_top(margin.top)
      inner.set_margin_end(margin.right)
      inner.set_margin_bottom(margin.bottom)
      inner.set_margin_start(margin.left)
    }
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
    const marginStart = inner.get_margin_start()
    const marginEnd = inner.get_margin_end()
    const marginTop = inner.get_margin_top()
    const marginBottom = inner.get_margin_bottom()
    const left = alloc.x + marginStart
    const right = alloc.x + alloc.width - marginEnd
    const top = alloc.y + marginTop
    const bottom = alloc.y + alloc.height - marginBottom
    const inside = x >= left && x <= right && y >= top && y <= bottom
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

  onNetworkConfigChange(() => {
    applyConfig(resolveNetworkConfig(cfg))
  })

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
