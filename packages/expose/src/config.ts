import GLib from "gi://GLib"

export type PreviewMode = "default" | "overlay"
export type DisplayType = "default" | "workspaces" // extend later

export type ExposeConfig = {
  iconSize: number
  currentPreviewMode: PreviewMode
  displayType: DisplayType

  // optional extra knobs (you’ll want them)
  minTileW: number
  minTileH: number
  refreshMs: number
  heavyModeThreshold: number
}

export const defaultConfig: ExposeConfig = {
  iconSize: 60,
  currentPreviewMode: "overlay",
  displayType: "default",

  minTileW: 360,
  minTileH: 240,
  refreshMs: 0,
  heavyModeThreshold: 28,
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function clampInt(n: unknown, def: number, min = 1, max = 512) {
  const v = Number(n)
  if (!Number.isFinite(v)) return def
  return Math.max(min, Math.min(max, Math.floor(v)))
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : def
}

export function loadExposeConfig(): ExposeConfig {
  const path = `${GLib.get_home_dir()}/.config/ags/expose.json`

  let user: unknown = null
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (txt) user = JSON.parse(new TextDecoder().decode(txt))
  } catch {
    // no file or invalid JSON → use defaults
  }

  const u = isObject(user) ? user : {}

  return {
    ...defaultConfig,
    iconSize: clampInt(u.iconSize, defaultConfig.iconSize, 8, 256),
    currentPreviewMode: oneOf(u.currentPreviewMode, ["default", "overlay"] as const, defaultConfig.currentPreviewMode),
    displayType: oneOf(u.displayType, ["default", "workspaces"] as const, defaultConfig.displayType),

    minTileW: clampInt(u.minTileW, defaultConfig.minTileW, 120, 2000),
    minTileH: clampInt(u.minTileH, defaultConfig.minTileH, 80, 2000),
    refreshMs: clampInt(u.refreshMs, defaultConfig.refreshMs, 0, 60000),
    heavyModeThreshold: clampInt(u.heavyModeThreshold, defaultConfig.heavyModeThreshold, 0, 500),
  }
}
