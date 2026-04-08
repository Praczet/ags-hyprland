import Gtk from "gi://Gtk"

import type { DashboardConfig, DashboardWidgetConfig } from "../config"
import {
  getWotdStore,
  createWotdCard,
  createWotdCompact,
  createWotdDefinitionOnly,
} from "../../../wotd/src"

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

export default function WordOfDayWidget(
  dashboardConfig: DashboardConfig,
  widget: DashboardWidgetConfig,
): Gtk.Widget {
  const cfg = isObject(widget.config) ? widget.config : {}

  const variant =
    typeof cfg.variant === "string" && ["card", "compact", "definition"].includes(cfg.variant)
      ? cfg.variant
      : "compact"

  const wotdConfig = {
    ...(dashboardConfig.wotd ?? {}),
    ...(cfg.cardPath ? { cardPath: String(cfg.cardPath) } : {}),
    ...(typeof cfg.maxMeanings !== "undefined" ? { maxMeanings: Number(cfg.maxMeanings) } : {}),
    ...(typeof cfg.showTranslations === "boolean" ? { showTranslations: cfg.showTranslations } : {}),
    ...(typeof cfg.showDate === "boolean" ? { showDate: cfg.showDate } : {}),
  }

  const store = getWotdStore(wotdConfig)
  const data = store.get() ?? store.reload()

  if (!data) {
    const label = new Gtk.Label({
      label: "No word of the day.",
      xalign: 0,
      wrap: true,
    })
    label.add_css_class("dashboard-wotd-empty")
    return label
  }

  if (variant === "definition") {
    return createWotdDefinitionOnly(data, {
      showTitle: typeof cfg.showTitle === "boolean" ? cfg.showTitle : true,
      showWord: typeof cfg.showWord === "boolean" ? cfg.showWord : true,
      showPronunciation: typeof cfg.showPronunciation === "boolean" ? cfg.showPronunciation : false,
      showPartOfSpeech: typeof cfg.showPartOfSpeech === "boolean" ? cfg.showPartOfSpeech : true,
      showTranslation: typeof cfg.showTranslation === "boolean" ? cfg.showTranslation : true,
      showLang: typeof cfg.showLang === "boolean" ? cfg.showLang : false,
      showDate: typeof cfg.showDate === "boolean" ? cfg.showDate : false,
    })
  }

  if (variant === "compact") {
    return createWotdCompact(data, {
      showTitle: typeof cfg.showTitle === "boolean" ? cfg.showTitle : true,
      showWord: typeof cfg.showWord === "boolean" ? cfg.showWord : true,
      showPronunciation: typeof cfg.showPronunciation === "boolean" ? cfg.showPronunciation : true,
      showPartOfSpeech: typeof cfg.showPartOfSpeech === "boolean" ? cfg.showPartOfSpeech : true,
      showDefinition: typeof cfg.showDefinition === "boolean" ? cfg.showDefinition : true,
      showTranslations: typeof cfg.showTranslations === "boolean" ? cfg.showTranslations : true,
      showLang: typeof cfg.showLang === "boolean" ? cfg.showLang : false,
      showDate: typeof cfg.showDate === "boolean" ? cfg.showDate : false,
      maxMeanings: Number.isFinite(Number(cfg.maxMeanings)) ? Math.floor(Number(cfg.maxMeanings)) : 1,
      maxTranslations: Number.isFinite(Number(cfg.maxTranslations)) ? Math.floor(Number(cfg.maxTranslations)) : 1,
    })
  }

  return createWotdCard(data, {
    showTitle: typeof cfg.showTitle === "boolean" ? cfg.showTitle : true,
    showDate: typeof cfg.showDate === "boolean" ? cfg.showDate : Boolean(dashboardConfig.wotd?.showDate),
    showLang: typeof cfg.showLang === "boolean" ? cfg.showLang : true,
    showPronunciation: typeof cfg.showPronunciation === "boolean" ? cfg.showPronunciation : true,
    showPartOfSpeech: typeof cfg.showPartOfSpeech === "boolean" ? cfg.showPartOfSpeech : true,
    showDefinition: typeof cfg.showDefinition === "boolean" ? cfg.showDefinition : true,
    showMeanings: typeof cfg.showMeanings === "boolean" ? cfg.showMeanings : true,
    showTranslations: typeof cfg.showTranslations === "boolean"
      ? cfg.showTranslations
      : Boolean(dashboardConfig.wotd?.showTranslations ?? true),
    maxMeanings: Number.isFinite(Number(cfg.maxMeanings))
      ? Math.floor(Number(cfg.maxMeanings))
      : Number.isFinite(Number(dashboardConfig.wotd?.maxMeanings))
        ? Math.floor(Number(dashboardConfig.wotd?.maxMeanings))
        : 3,
    maxTranslations: Number.isFinite(Number(cfg.maxTranslations))
      ? Math.floor(Number(cfg.maxTranslations))
      : 1,
    compact: false,
  })
}
