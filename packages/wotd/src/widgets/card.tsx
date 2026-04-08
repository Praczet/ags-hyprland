import Gtk from "gi://Gtk"
import type { WotdCardData, WotdCardOptions } from "../types"


const DEFAULT_OPTIONS: Required<WotdCardOptions> = {
  showTitle: true,
  showDate: true,
  showLang: true,
  showPronunciation: true,
  showPartOfSpeech: true,
  showDefinition: true,
  showMeanings: true,
  showTranslations: true,
  maxMeanings: 3,
  maxTranslations: 3,
  maxWidth: 220,
  minHeight: 180,
  compact: false,
  titleOverride: "",
}

function resolveOptions(options?: WotdCardOptions): Required<WotdCardOptions> {
  const o = options ?? {}

  return {
    showTitle: typeof o.showTitle === "boolean" ? o.showTitle : DEFAULT_OPTIONS.showTitle,
    showDate: typeof o.showDate === "boolean" ? o.showDate : DEFAULT_OPTIONS.showDate,
    showLang: typeof o.showLang === "boolean" ? o.showLang : DEFAULT_OPTIONS.showLang,
    showPronunciation: typeof o.showPronunciation === "boolean" ? o.showPronunciation : DEFAULT_OPTIONS.showPronunciation,
    showPartOfSpeech: typeof o.showPartOfSpeech === "boolean" ? o.showPartOfSpeech : DEFAULT_OPTIONS.showPartOfSpeech,
    showDefinition: typeof o.showDefinition === "boolean" ? o.showDefinition : DEFAULT_OPTIONS.showDefinition,
    showMeanings: typeof o.showMeanings === "boolean" ? o.showMeanings : DEFAULT_OPTIONS.showMeanings,
    showTranslations: typeof o.showTranslations === "boolean" ? o.showTranslations : DEFAULT_OPTIONS.showTranslations,
    maxMeanings: Number.isFinite(Number(o.maxMeanings)) ? Math.max(0, Math.floor(Number(o.maxMeanings))) : DEFAULT_OPTIONS.maxMeanings,
    maxTranslations: Number.isFinite(Number(o.maxTranslations)) ? Math.max(0, Math.floor(Number(o.maxTranslations))) : DEFAULT_OPTIONS.maxTranslations,
    maxWidth: Number.isFinite(Number(o.maxWidth)) ? Math.max(100, Math.floor(Number(o.maxWidth))) : DEFAULT_OPTIONS.maxWidth,
    minHeight: Number.isFinite(Number(o.minHeight)) ? Math.max(0, Math.floor(Number(o.minHeight))) : DEFAULT_OPTIONS.minHeight,
    compact: typeof o.compact === "boolean" ? o.compact : DEFAULT_OPTIONS.compact,
    titleOverride: typeof o.titleOverride === "string" ? o.titleOverride : DEFAULT_OPTIONS.titleOverride,
  }
}

function wrapWithSizeConstraint(widget: Gtk.Widget, maxWidth: number, minHeight: number) {
  const scroller = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    max_content_width: maxWidth,
    min_content_width: maxWidth,
    min_content_height: minHeight,
    halign: Gtk.Align.FILL,
    valign: Gtk.Align.FILL,
    hexpand: true,
    vexpand: true,
  })

  scroller.set_child(widget)
  return scroller
}

function makeLabel(text: string, classes: string[] = [], wrap = false, xalign = 0, hexpand = false): Gtk.Label {
  const label = new Gtk.Label({
    label: text,
    xalign: xalign,
    wrap,
    hexpand: hexpand,
  })

  classes.forEach(cls => label.add_css_class(cls))
  return label
}

function formatLangLabel(data: WotdCardData): string | null {
  if (!data.lang && !data.trans_lang) return null
  if (data.lang && data.trans_lang) return `${data.lang.toUpperCase()} → ${data.trans_lang.toUpperCase()}`
  return data.lang.toUpperCase()
}

function formatPartOfSpeech(value?: string): string | null {
  if (!value) return null
  return value.toUpperCase()
}

export function createWotdCard(data: WotdCardData, options?: WotdCardOptions): Gtk.Widget {
  const o = resolveOptions(options)

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: o.compact ? 8 : 12,
  })
  root.add_css_class("wotd-card")

  if (o.compact) {
    root.add_css_class("wotd-card-compact")
  }

  // Header
  if (o.showTitle || o.showDate || o.showLang) {
    const header = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
    })
    header.add_css_class("wotd-header")

    const headerLeft = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 2,
      hexpand: true,
    })

    const title = o.titleOverride.trim() || data.title
    if (o.showTitle && title) {
      headerLeft.append(makeLabel(title, ["wotd-title"]))
    }

    if (o.showDate && data.date) {
      headerLeft.append(makeLabel(data.date, ["wotd-date"], false, 0.5, true))
    }

    header.append(headerLeft)

    const langLabel = o.showLang ? formatLangLabel(data) : null
    if (langLabel) {
      const headerRight = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        halign: Gtk.Align.END,
      })
      headerRight.append(makeLabel(langLabel, ["wotd-lang"]))
      header.append(headerRight)
    }

    root.append(header)
  }

  // Word
  root.append(makeLabel(data.word, ["wotd-word"], false, 0.5, true))

  // Pronunciation
  if (o.showPronunciation && data.pronunciation) {
    root.append(makeLabel(data.pronunciation, ["wotd-pronunciation"], false, 0.5, true))
  }


  // Part of speech
  if (o.showPartOfSpeech && data.part_of_speech) {
    const pos = formatPartOfSpeech(data.part_of_speech)
    if (pos) {
      root.append(makeLabel(`[${pos}]`, ["wotd-part-of-speech"]))
    }
  }

  // Definition
  if (o.showDefinition && data.definition) {
    root.append(makeLabel(data.definition, ["wotd-definition"], true))
  }


  // Meanings
  if (o.showMeanings && o.maxMeanings > 0 && data.meanings.length > 0) {
    const meaningsBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    })
    meaningsBox.add_css_class("wotd-meanings")

    for (const meaning of data.meanings.slice(0, o.maxMeanings)) {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
      })
      row.add_css_class("wotd-meaning-row")

      const idx = makeLabel(`${meaning.index}.`, ["wotd-meaning-index"])
      const txt = makeLabel(meaning.text, ["wotd-meaning-text"], true)

      row.append(idx)
      row.append(txt)
      meaningsBox.append(row)
    }

    root.append(meaningsBox)
  }

  // Translations
  if (o.showTranslations && o.maxTranslations > 0 && data.translations.length > 0) {
    const translations = data.translations.slice(0, o.maxTranslations)

    const transBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    })
    transBox.add_css_class("wotd-translations")

    transBox.append(makeLabel("Translation", ["wotd-translations-title"], false, 0.5, true))

    for (const item of translations) {
      transBox.append(makeLabel(item, ["wotd-translation"], true))
    }

    root.append(transBox)
  }

  return wrapWithSizeConstraint(root, o.maxWidth, o.minHeight)
}
