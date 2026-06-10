import GLib from "gi://GLib"
import Gio from "gi://Gio"

import type { LyricsConfig, ResolvedLyricsConfig } from "./types"

const CONFIG_PATH = `${GLib.get_home_dir()}/.config/ags/lyrics.json`

const DEFAULT_CONFIG: ResolvedLyricsConfig = {
  cacheDir: `${GLib.get_home_dir()}/.local/share/lyrics`,
  refreshMs: 1000,
  positionRefreshMs: 1000,
  metadataRefreshMs: 2500,
  lookupOnMissing: true,
  maxLines: 3,
  width: 860,
  monitor: 0,
  opacity: 0.92,
  position: ["top", "center"],
  marginTop: 18,
  marginBottom: 18,
  marginLeft: 24,
  marginRight: 24,
}

function expandHome(path: string) {
  if (path === "~") return GLib.get_home_dir()
  if (path.startsWith("~/")) return `${GLib.get_home_dir()}/${path.slice(2)}`
  return path
}

function readUserConfig(): LyricsConfig {
  try {
    const file = Gio.File.new_for_path(CONFIG_PATH)
    if (!file.query_exists(null)) return {}

    const [, contents] = file.load_contents(null)
    const text = new TextDecoder().decode(contents)
    const parsed = JSON.parse(text)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as LyricsConfig
  } catch (err) {
    console.error("[lyrics] failed to read config", err)
    return {}
  }
}

function normalizePosition(value: LyricsConfig["position"]): ResolvedLyricsConfig["position"] {
  if (!Array.isArray(value)) return DEFAULT_CONFIG.position

  const allowed = new Set(DEFAULT_CONFIG.position.concat(["bottom", "left", "right"]))
  const normalized = value.filter(item => allowed.has(item))

  return normalized.length > 0 ? normalized : DEFAULT_CONFIG.position
}

export function resolveLyricsConfig(userConfig?: LyricsConfig): ResolvedLyricsConfig {
  const loaded = readUserConfig()
  const merged = { ...DEFAULT_CONFIG, ...loaded, ...userConfig }

  return {
    ...DEFAULT_CONFIG,
    ...merged,
    cacheDir: expandHome(merged.cacheDir ?? DEFAULT_CONFIG.cacheDir),
    refreshMs: Math.max(250, Number(merged.refreshMs ?? DEFAULT_CONFIG.refreshMs)),
    positionRefreshMs: Math.max(150, Number(merged.positionRefreshMs ?? merged.refreshMs ?? DEFAULT_CONFIG.positionRefreshMs)),
    metadataRefreshMs: Math.max(750, Number(merged.metadataRefreshMs ?? DEFAULT_CONFIG.metadataRefreshMs)),
    maxLines: Math.max(1, Number(merged.maxLines ?? DEFAULT_CONFIG.maxLines)),
    width: Math.max(240, Number(merged.width ?? DEFAULT_CONFIG.width)),
    monitor: Math.max(0, Number(merged.monitor ?? DEFAULT_CONFIG.monitor)),
    opacity: Math.min(1, Math.max(0.2, Number(merged.opacity ?? DEFAULT_CONFIG.opacity))),
    position: normalizePosition(merged.position),
    marginTop: Math.max(0, Number(merged.marginTop ?? DEFAULT_CONFIG.marginTop)),
    marginBottom: Math.max(0, Number(merged.marginBottom ?? DEFAULT_CONFIG.marginBottom)),
    marginLeft: Math.max(0, Number(merged.marginLeft ?? DEFAULT_CONFIG.marginLeft)),
    marginRight: Math.max(0, Number(merged.marginRight ?? DEFAULT_CONFIG.marginRight)),
    lookupOnMissing: merged.lookupOnMissing !== false,
  }
}
