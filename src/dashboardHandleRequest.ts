import { createRoot } from "ags"
import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import { DashboardWindow } from "../packages/dashboard/src"
import { hideAppWindow, toggleAppWindow } from "./windowControl"
import { getAppWindow, type DashboardAppWindow, type RequestResponse, WINDOW_NAME } from "./windowTypes"

function normalizeConfigPath(path?: string) {
  const raw = typeof path === "string" ? path.trim() : ""
  if (!raw) return undefined
  if (raw.startsWith("~/")) return `${GLib.get_home_dir()}/${raw.slice(2)}`
  if (GLib.path_is_absolute(raw)) return raw
  return `${GLib.get_home_dir()}/.config/ags/${raw}`
}

function hashPath(value: string) {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

const dashboardWindows = new Map<string, DashboardAppWindow>()

function getDashboardWindow(configPath?: string) {
  const normalized = normalizeConfigPath(configPath)
  const name = normalized ? `${WINDOW_NAME.dashboard}-${hashPath(normalized)}` : WINDOW_NAME.dashboard
  let w = dashboardWindows.get(name)
  if (!w) w = getAppWindow<DashboardAppWindow>(name)
  if (!w) {
    const built = createRoot((dispose) => {
      const widget = DashboardWindow(0, normalized, name) as DashboardAppWindow
      return { widget, dispose }
    })
    w = built.widget
    w._rootDispose = built.dispose
    try {
      w.connect?.("destroy", () => {
        dashboardWindows.delete(name)
        w?._rootDispose?.()
      })
    } catch {
      // best-effort cleanup
    }
    app.add_window(w)
  }
  dashboardWindows.set(name, w)
  return w
}

function toggleDashboard(configPath?: string) {
  const w = getDashboardWindow(configPath)
  if (!w) return
  dashboardWindows.forEach((win) => {
    if (win && win !== w && win.visible) {
      hideAppWindow<DashboardAppWindow>(win.name)
    }
  })
  toggleAppWindow<DashboardAppWindow>(w.name)
}

function refreshAllDashboards(method: "refreshGoogle" | "refreshTickTick") {
  dashboardWindows.forEach((w) => {
    try {
      const callback = w[method]
      if (typeof callback === "function") callback.call(w)
    } catch {
      // best-effort refresh
    }
  })
}

export async function dashboardHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd, configPath] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "toggledashboard":
    case "dashboardtoggle": {
      toggleDashboard(configPath)
      return "ok"
    }
    case "google-refresh": {
      refreshAllDashboards("refreshGoogle")
      return "ok"
    }
    case "ticktick-refresh": {
      refreshAllDashboards("refreshTickTick")
      return "ok"
    }
  }
  return undefined
}
