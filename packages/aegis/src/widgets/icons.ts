import { Gdk, Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { SysinfoModel } from "../types"

const SEARCH_DIRS = [
  "/usr/share/icons",
  `${GLib.get_home_dir()}/.local/share/icons`,
]

const HYPRLAND_FALLBACK = "/home/adam/.cache/paru/clone/hyprsysteminfo/src/hyprsysteminfo-0.1.3/resource/hyprlandlogo.svg"
const ICON_EXTS = ["svg", "png"]

let iconTheme: Gtk.IconTheme | null = null
let searchPathsSet = false
const fileCache = new Map<string, string | null>()

function getIconTheme() {
  if (iconTheme) return iconTheme
  const display = Gdk.Display.get_default()
  if (!display) return null
  iconTheme = Gtk.IconTheme.get_for_display(display)
  return iconTheme
}

function ensureSearchPaths() {
  if (searchPathsSet) return
  const theme = getIconTheme()
  if (!theme) return
  for (const dir of SEARCH_DIRS) {
    try {
      theme.add_search_path(dir)
    } catch {
      // ignore
    }
  }
  searchPathsSet = true
}

function listDirectories(path: string) {
  try {
    const dir = Gio.File.new_for_path(path)
    const enumr = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null)
    const dirs: string[] = []
    let info: Gio.FileInfo | null
    while ((info = enumr.next_file(null)) !== null) {
      if (info.get_file_type() === Gio.FileType.DIRECTORY) dirs.push(info.get_name())
    }
    enumr.close(null)
    return dirs
  } catch {
    return []
  }
}

function findIconFileForName(name: string): string | null {
  if (fileCache.has(name)) return fileCache.get(name) ?? null

  for (const base of SEARCH_DIRS) {
    const themes = listDirectories(base)
    for (const theme of themes) {
      const themePath = `${base}/${theme}`
      const sizeDirs = listDirectories(themePath)
      for (const size of sizeDirs) {
        const sizePath = `${themePath}/${size}`
        const contexts = listDirectories(sizePath)
        for (const ctx of contexts) {
          for (const ext of ICON_EXTS) {
            const candidate = `${sizePath}/${ctx}/${name}.${ext}`
            if (GLib.file_test(candidate, GLib.FileTest.EXISTS)) {
              fileCache.set(name, candidate)
              return candidate
            }
          }
        }
        for (const ext of ICON_EXTS) {
          const candidate = `${sizePath}/${name}.${ext}`
          if (GLib.file_test(candidate, GLib.FileTest.EXISTS)) {
            fileCache.set(name, candidate)
            return candidate
          }
        }
      }
    }
  }

  fileCache.set(name, null)
  return null
}

function normalizeName(input: string) {
  const cleaned = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return cleaned
}

function buildOsCandidates(os: SysinfoModel["os"]) {
  const candidates = new Set<string>()
  for (const raw of [os.id, os.name, os.prettyName, os.variant]) {
    if (!raw) continue
    const normalized = normalizeName(raw)
    if (!normalized) continue
    candidates.add(normalized)
    if (normalized.endsWith("-linux")) candidates.add(normalized.replace(/-linux$/, ""))
    if (normalized.startsWith("linux-")) candidates.add(normalized.replace(/^linux-/, ""))
  }
  candidates.add("distributor-logo")
  candidates.add("distributor-logo-symbolic")
  candidates.add("linux")
  return Array.from(candidates)
}

function buildHyprlandCandidates() {
  return ["hyprland", "hyprland-logo", "hyprland-symbolic"]
}

export type ResolvedIcon = { iconName?: string; file?: string }

function resolveIcon(names: string[], fallbackFile?: string): ResolvedIcon | null {
  ensureSearchPaths()
  const theme = getIconTheme()
  for (const name of names) {
    if (theme?.has_icon(name)) return { iconName: name }
    const file = findIconFileForName(name)
    if (file) return { file }
  }
  if (fallbackFile && GLib.file_test(fallbackFile, GLib.FileTest.EXISTS)) return { file: fallbackFile }
  return null
}

export function resolveOsIcon(os: SysinfoModel["os"]) {
  const names = buildOsCandidates(os)
  return resolveIcon(names)
}

export function resolveHyprlandIcon() {
  return resolveIcon(buildHyprlandCandidates(), HYPRLAND_FALLBACK)
}

export function buildIconImage(icon: ResolvedIcon | null, size: number) {
  if (!icon) return null
  const img = new Gtk.Image({ pixel_size: size })
  if (icon.iconName) img.set_from_icon_name(icon.iconName)
  if (icon.file) img.set_from_file(icon.file)
  img.add_css_class("aegis-hero-icon")
  return img
}
