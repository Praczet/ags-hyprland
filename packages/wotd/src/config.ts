import { WotdConfig } from "./types"
import GLib from "gi://GLib"

const DEFAULTS = Object.freeze({
  cardPath: "~/.cache/mdj/card.json",
  maxWidth: 520,
  minHeight: 380,
  popupDurationMs: 5000,
  popupWidth: 520,
  popupMarginTop: 20,
  maxMeanings: 3,
  maxTranslations: 1,
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

  const cardType =
    u.cardType === "compact" || u.cardType === "definition-only"
      ? u.cardType
      : "card"

  return {
    cardPath: resolveWotdCardPath(u.cardPath),
    maxWidth: toInt(u.maxWidth, DEFAULTS.maxWidth, 100),
    minHeight: toInt(u.minHeight, DEFAULTS.minHeight, 0),
    popupDurationMs: toInt(u.popupDurationMs, DEFAULTS.popupDurationMs),
    popupWidth: toInt(
      u.popupWidth,
      Number.isFinite(Number(u.maxWidth)) ? Number(u.maxWidth) : DEFAULTS.popupWidth,
      100,
    ),
    cardType,
    popupMarginTop: toInt(u.popupMarginTop, DEFAULTS.popupMarginTop),
    maxMeanings: toInt(u.maxMeanings, DEFAULTS.maxMeanings),
    maxTranslations: toInt(u.maxTranslations, DEFAULTS.maxTranslations),
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
