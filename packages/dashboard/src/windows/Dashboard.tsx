import { Astal, Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { loadDashboardConfig, type DashboardWidgetConfig } from "../config"
import { getSysinfoService } from "../../../aegis/src"
import { createCustomWidget, createDashboardWidgetRegistry } from "./widgetRegistry"

export const DASHBOARD_WINDOW_NAME = "dashboard"

export type DashboardWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
  refreshGoogle(): void
  refreshTickTick(): void
  showDashboard(): void
  hideDashboard(): void
}

type DashboardAnimationController = {
  animateIn(): void
  closeWindow(): void
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function createDashboardAnimationController(
  win: DashboardWindowHandle,
  widgetWrappers: Array<{ id: string; widget: Gtk.Widget }>,
): DashboardAnimationController {
  const animateIn = () => {
    widgetWrappers.forEach(({ widget }) => {
      widget.remove_css_class("dashboard-widget-exit")
      widget.remove_css_class("dashboard-widget-visible")
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      widgetWrappers.forEach(({ widget }, i) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, i * 30, () => {
          widget.add_css_class("dashboard-widget-visible")
          return GLib.SOURCE_REMOVE
        })
      })
      return GLib.SOURCE_REMOVE
    })
  }

  const closeWindow = () => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 32, () => {
      widgetWrappers.forEach(({ widget }) => {
        widget.add_css_class("dashboard-widget-exit")
      })
      return GLib.SOURCE_REMOVE
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 48, () => {
      widgetWrappers.forEach(({ widget }) => widget.remove_css_class("dashboard-widget-visible"))
      return GLib.SOURCE_REMOVE
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      widgetWrappers.forEach(({ widget }) => {
        widget.remove_css_class("dashboard-widget-exit")
      })
      win.visible = false
      return GLib.SOURCE_REMOVE
    })
  }

  return { animateIn, closeWindow }
}

export function DashboardWindow(monitor: number = 0, configPath?: string, windowName?: string) {
  const cfg = loadDashboardConfig(configPath)
  const aegisWidgets = cfg.widgets.filter(w => w.type.startsWith("aegis"))
  const aegisConfigs = aegisWidgets.map(w => (isObject(w.config) ? w.config : {}))
  const allowBackgroundRefresh = aegisConfigs.some(c => c.allowBackgroundRefresh === true)
  const refreshOnShow = aegisConfigs.some(c => c.refreshOnShow === false) ? false : true
  let closeDashboard = () => { }
  const { google, registry, ticktick } = createDashboardWidgetRegistry(cfg, () => closeDashboard())
  const setAegisActive = (active: boolean) => {
    if (!aegisWidgets.length) return
    getSysinfoService().setActive("dashboard", active, { allowBackgroundRefresh, refreshOnShow })
  }
  setAegisActive(false)
  const grid = new Gtk.Grid({
    row_spacing: cfg.layout.gap,
    column_spacing: cfg.layout.gap,
    margin_top: cfg.layout.padding,
    margin_bottom: cfg.layout.padding,
    margin_start: cfg.layout.padding,
    margin_end: cfg.layout.padding,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ["dashboard-grid"],
  })
  grid.set_hexpand(false)
  grid.set_vexpand(false)
  grid.set_column_homogeneous(false)
  grid.set_row_homogeneous(false)

  const widgetWrappers: { id: string; widget: Gtk.Widget }[] = []
  const widgets = cfg.widgets

  widgets.forEach((w, index) => {
    const wrapper = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      cssClasses: ["dashboard-widget"],
      halign: Gtk.Align.START,
      valign: Gtk.Align.START,
    })
    wrapper.set_hexpand(false)
    wrapper.set_vexpand(false)
    const defaultExpand = w.type === "sticky-notes" || w.type === "sticky-note"
    const expandX = typeof w.expandX === "boolean" ? w.expandX : defaultExpand
    const expandY = typeof w.expandY === "boolean" ? w.expandY : defaultExpand
    if (expandX) {
      wrapper.set_hexpand(true)
      wrapper.set_halign(Gtk.Align.FILL)
    }
    if (expandY) {
      wrapper.set_vexpand(true)
      wrapper.set_valign(Gtk.Align.FILL)
    }
    if (typeof w.minWidth === "number") wrapper.set_size_request(w.minWidth, -1)
    if (typeof w.minHeight === "number") wrapper.set_size_request(-1, w.minHeight)
    if (w.showBackground === false) wrapper.add_css_class("dashboard-widget-no-bg")
    if (w.showBorder === false) wrapper.add_css_class("dashboard-widget-no-border")
    if (w.showShadow === false) wrapper.add_css_class("dashboard-widget-no-shadow")
    const widgetCfg = isObject(w.config) ? w.config : {}
    if (widgetCfg.showTitle === false) wrapper.add_css_class("dashboard-widget-no-title")

    let content: Gtk.Widget
    if (w.type === "custom") {
      content = createCustomWidget(w.customName, w.config, wrapper)
    } else {
      const make = registry[w.type] ?? registry.custom
      content = make(w)
    }

    wrapper.append(content)

    const autoFrom = ["left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"][index % 8] as DashboardWidgetConfig["from"]
    const from = w.from ?? autoFrom
    wrapper.add_css_class(`from-${from}`)
    wrapper.add_css_class(`exit-from-${from}`)

    grid.attach(wrapper, w.col - 1, w.row - 1, w.colSpan ?? 1, w.rowSpan ?? 1)
    widgetWrappers.push({ id: w.id, widget: wrapper })
  })

  const container = (
    <box
      class="dashboard-root"
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      vexpand={true}
      hexpand={true}
    >
      {grid}
    </box>
  )

  const win = (
    <window
      name={windowName ?? DASHBOARD_WINDOW_NAME}
      namespace="adart-dashboard"
      class="dashboard"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      onShow={() => setAegisActive(true)}
      onHide={() => setAegisActive(false)}
      $={(self: Astal.Window) => {
        const keys = new Gtk.EventControllerKey()
        keys.connect(
          "key-pressed",
          (_ctrl: Gtk.EventControllerKey, keyval: number) => {
            if (keyval === Gdk.KEY_Escape) {
              closeDashboard()
              return true
            }
            return false
          },
        )
        self.add_controller(keys)
      }}
    >
      {container}
    </window>
  ) as DashboardWindowHandle

  const animation = createDashboardAnimationController(win, widgetWrappers)
  closeDashboard = animation.closeWindow

  win.refreshGoogle = () => google?.refresh()
  win.refreshTickTick = () => ticktick?.refresh()

  win.openWindow = () => {
    if (typeof win.present === "function") {
      win.present()
    } else {
      win.visible = true
    }
    win.grab_focus()
    animation.animateIn()
  }
  win.closeWindow = () => {
    closeDashboard()
  }
  win.showDashboard = win.openWindow
  win.hideDashboard = win.closeWindow

  return win
}
