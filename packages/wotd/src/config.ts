import { WotdConfig } from "./types"
import GLib from "gi://GLib"

const DEFAULTS = Object.freeze({
  cardPath: "~/.cache/mdj/card.json",
  popupDurationMs: 5000,
  popupWidth: 220,
  popupMarginTop: 20,
  maxMeanings: 3,
  showTranslations: true,
  showDate: true,
})

function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return `${GLib.get_home_dir()}/${path.slice(2)}`
  }
  return path
}

function toInt(value: unknown, fallback: number, min = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.floor(n)) : fallback
}

export function resolveWotdCardPath(path?: string): string {
  const raw = typeof path === "string" ? path.trim() : ""

  if (!raw) {
    return expandHome(DEFAULTS.cardPath)
  }

  if (raw.startsWith("~/")) {
    return expandHome(raw)
  }

  if (GLib.path_is_absolute(raw)) {
    return raw
  }

  return `${GLib.get_home_dir()}/.config/ags/${raw}`
}

export function resolveWotdConfig(user?: WotdConfig): Required<WotdConfig> {
  const u = user ?? {}

  return {
    cardPath: resolveWotdCardPath(u.cardPath),
    popupDurationMs: toInt(u.popupDurationMs, DEFAULTS.popupDurationMs),
    popupWidth: toInt(u.popupWidth, DEFAULTS.popupWidth, 100),
    cardType: u.cardType === "compact" ? "compact" : "card",
    popupMarginTop: toInt(u.popupMarginTop, DEFAULTS.popupMarginTop),
    maxMeanings: toInt(u.maxMeanings, DEFAULTS.maxMeanings),
    showTranslations:
      typeof u.showTranslations === "boolean"
        ? u.showTranslations
        : DEFAULTS.showTranslations,
    showDate:
      typeof u.showDate === "boolean"
        ? u.showDate
        : DEFAULTS.showDate,
  }
}

export const DEFAULT_WOTD_CARD_PATH = expandHome(DEFAULTS.cardPath)
export const DEFAULT_WOTD_POPUP_DURATION = DEFAULTS.popupDurationMs
export type ResolvedWotdConfig = ReturnType<typeof resolveWotdConfig>
