import { createRoot } from "ags"
import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import { DashboardWindow } from "../packages/dashboard/src"

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

const dashboardWindows = new Map<string, any>()

function getDashboardWindow(configPath?: string) {
  const normalized = normalizeConfigPath(configPath)
  const name = normalized ? `dashboard-${hashPath(normalized)}` : "dashboard"
  let w = dashboardWindows.get(name) as any
  if (!w) w = app.get_window(name) as any
  if (!w) {
    const built = createRoot((dispose) => {
      const widget = DashboardWindow(0, normalized, name) as any
      return { widget, dispose }
    })
    w = built.widget as any
    ; (w as any)._rootDispose = built.dispose
    try {
      w.connect("destroy", () => {
        dashboardWindows.delete(name)
        ; (w as any)._rootDispose?.()
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
  if (w.visible) {
    w.hideDashboard?.() ?? w.hide()
    return
  }
  dashboardWindows.forEach((win) => {
    if (win && win !== w && win.visible) {
      win.hideDashboard?.() ?? win.hide()
    }
  })
  w.showDashboard?.()
}

export async function dashboardHandleRequest(argv: string[]) {
  const [cmd, configPath] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "toggledashboard":
    case "dashboardtoggle": {
      toggleDashboard(configPath)
      return "ok"
    }
  }
  return undefined
}
