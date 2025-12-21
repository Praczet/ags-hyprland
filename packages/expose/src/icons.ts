// src/icons.ts
import Gio from "gi://Gio"
import GioUnix from "gi://GioUnix"
import type { ExposeClient } from "./store"

let cache = new Map<string, Gio.Icon | null>()


export function iconForClient(client: ExposeClient): Gio.Icon | null {
  const key = (client.class || "").toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key)!

  // Try direct desktop id match: "firefox.desktop", "org.gnome.Nautilus.desktop", etc.
  const directIds = [
    `${client.class}.desktop`,
    `${key}.desktop`,
  ]

  for (const id of directIds) {
    const app = GioUnix.DesktopAppInfo.new(id)
    if (app) {
      const icon = app.get_icon()
      cache.set(key, icon)
      return icon
    }
  }

  // Fallback: scan all desktop apps and match StartupWMClass
  const all = Gio.AppInfo.get_all()
  for (const ai of all) {
    const dai = ai as unknown as GioUnix.DesktopAppInfo
    if (!("get_startup_wm_class" in dai)) continue

    const wm = (dai as any).get_startup_wm_class?.()
    if (typeof wm === "string" && wm.toLowerCase() === key) {
      const icon = (dai as any).get_icon?.() ?? null
      cache.set(key, icon)
      return icon
    }
  }

  cache.set(key, null)
  return null
}

