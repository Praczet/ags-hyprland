import GLib from "gi://GLib"
import type { NetworkSectionConfig, NetworkSectionName, NetworkWidgetConfig } from "./types"

const SECTION_NAMES: NetworkSectionName[] = ["wifi", "wired", "vpn", "hotspot", "bluetooth", "utilities"]

export function getNetworkConfigPath() {
  return `${GLib.get_user_config_dir()}/ags/a-networkmanager.json`
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function toBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined
}

function toInt(v: unknown): number | undefined {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.floor(n)
}

function toString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

function parseSections(v: unknown): NetworkSectionConfig[] | undefined {
  if (!Array.isArray(v)) return undefined
  const result: NetworkSectionConfig[] = []
  for (const entry of v) {
    if (!isObject(entry)) continue
    const section = toString(entry.section)
    if (!section || !(SECTION_NAMES as string[]).includes(section)) continue
    result.push({
      section: section as NetworkSectionName,
      visible: toBool(entry.visible),
      order: toInt(entry.order),
    })
  }
  return result.length ? result : undefined
}

function parseButtons(v: unknown) {
  if (!Array.isArray(v)) return undefined
  const result = []
  for (const entry of v) {
    if (!isObject(entry)) continue
    const command = toString(entry.command)
    if (!command) continue
    result.push({
      order: toInt(entry.order),
      label: toString(entry.label),
      icon: toString(entry.icon),
      command,
    })
  }
  return result.length ? result : undefined
}

export function loadNetworkConfig(): NetworkWidgetConfig {
  const path = getNetworkConfigPath()
  let user: unknown = null
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (txt) user = JSON.parse(new TextDecoder().decode(txt))
  } catch {
    // no file or invalid JSON -> use defaults
  }

  const u = isObject(user) ? user : {}

  const cfg: NetworkWidgetConfig = {}
  cfg.refreshMs = toInt(u.refreshMs)
  cfg.educationModeOn = toBool(u.educationModeOn)
  cfg.educationModeDetail = toString(u.educationModeDetail) as NetworkWidgetConfig["educationModeDetail"]
  cfg.showQRPassword = toBool(u.showQRPassword)
  cfg.showPlainTextPassword = toBool(u.showPlainTextPassword)
  cfg.wiredNoInternetByIp = toBool(u.wiredNoInternetByIp)
  cfg.allowBackgroundRefresh = toBool(u.allowBackgroundRefresh)
  cfg.refreshOnShow = toBool(u.refreshOnShow)
  cfg.windowLess = toBool(u.windowLess)
  cfg.windowless = toBool(u.windowless)

  const sections = parseSections(u.sections)
  if (sections) cfg.sections = sections
  const buttons = parseButtons(u.buttons)
  if (buttons) cfg.buttons = buttons

  if (isObject(u.layout)) {
    const anchor = toString(u.layout.anchor)
    const margin = toString(u.layout.margin) ?? toString((u.layout as Record<string, unknown>).maring)
    cfg.layout = {
      anchor,
      margin,
    }
  }

  return cfg
}

type NetworkConfigListener = () => void
const configListeners = new Set<NetworkConfigListener>()

export function onNetworkConfigChange(listener: NetworkConfigListener) {
  configListeners.add(listener)
  return () => configListeners.delete(listener)
}

function notifyNetworkConfigChange() {
  for (const listener of configListeners) listener()
}

export function updateNetworkConfig(updates: Record<string, unknown>) {
  const path = getNetworkConfigPath()
  let user: unknown = null
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (txt) user = JSON.parse(new TextDecoder().decode(txt))
  } catch {
    user = null
  }
  const base = isObject(user) ? user : {}
  const next = { ...base, ...updates }
  try {
    GLib.file_set_contents(path, JSON.stringify(next, null, 2))
    notifyNetworkConfigChange()
  } catch (err) {
    console.error("a-network config write error", err)
  }
}

export function resolveNetworkConfig(override: NetworkWidgetConfig = {}): NetworkWidgetConfig {
  const base = loadNetworkConfig()
  const merged: NetworkWidgetConfig = {
    ...base,
    ...override,
  }

  if (base.layout || override.layout) {
    merged.layout = {
      ...(base.layout ?? {}),
      ...(override.layout ?? {}),
    }
  }

  if (override.sections !== undefined) {
    merged.sections = override.sections
  }

  if (override.windowless !== undefined) {
    merged.windowLess = override.windowless
  } else if (base.windowless !== undefined && override.windowLess === undefined) {
    merged.windowLess = base.windowless
  }

  return merged
}
