import Gtk from "gi://Gtk"
import type { WotdCardData, WotdCompactOptions, WotdDefinitionOnlyOptions } from "../types"

const DEFAULT_COMPACT_OPTIONS: Required<WotdCompactOptions> = {
  showTitle: true,
  showWord: true,
  showPronunciation: true,
  showPartOfSpeech: true,
  showDefinition: true,
  showTranslations: true,
  showLang: false,
  showDate: false,
  maxMeanings: 1,
  maxTranslations: 1,
  titleOverride: "",
}

const DEFAULT_DEFINITION_ONLY_OPTIONS: Required<WotdDefinitionOnlyOptions> = {
  showTitle: true,
  showWord: true,
  showPronunciation: false,
  showPartOfSpeech: true,
  showTranslation: true,
  showLang: false,
  showDate: false,
  titleOverride: "",
}

function makeLabel(text: string, classes: string[] = [], wrap = false): Gtk.Label {
  const label = new Gtk.Label({
    label: text,
    xalign: 0,
    wrap,
  })

  classes.forEach(cls => label.add_css_class(cls))
  return label
}

function toInt(value: unknown, fallback: number, min = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.floor(n)) : fallback
}

function resolveCompactOptions(options?: WotdCompactOptions): Required<WotdCompactOptions> {
  const o = options ?? {}

  return {
    showTitle: typeof o.showTitle === "boolean" ? o.showTitle : DEFAULT_COMPACT_OPTIONS.showTitle,
    showWord: typeof o.showWord === "boolean" ? o.showWord : DEFAULT_COMPACT_OPTIONS.showWord,
    showPronunciation: typeof o.showPronunciation === "boolean" ? o.showPronunciation : DEFAULT_COMPACT_OPTIONS.showPronunciation,
    showPartOfSpeech: typeof o.showPartOfSpeech === "boolean" ? o.showPartOfSpeech : DEFAULT_COMPACT_OPTIONS.showPartOfSpeech,
    showDefinition: typeof o.showDefinition === "boolean" ? o.showDefinition : DEFAULT_COMPACT_OPTIONS.showDefinition,
    showTranslations: typeof o.showTranslations === "boolean" ? o.showTranslations : DEFAULT_COMPACT_OPTIONS.showTranslations,
    showLang: typeof o.showLang === "boolean" ? o.showLang : DEFAULT_COMPACT_OPTIONS.showLang,
    showDate: typeof o.showDate === "boolean" ? o.showDate : DEFAULT_COMPACT_OPTIONS.showDate,
    maxMeanings: toInt(o.maxMeanings, DEFAULT_COMPACT_OPTIONS.maxMeanings),
    maxTranslations: toInt(o.maxTranslations, DEFAULT_COMPACT_OPTIONS.maxTranslations),
    titleOverride: typeof o.titleOverride === "string" ? o.titleOverride : DEFAULT_COMPACT_OPTIONS.titleOverride,
  }
}

function resolveDefinitionOnlyOptions(options?: WotdDefinitionOnlyOptions): Required<WotdDefinitionOnlyOptions> {
  const o = options ?? {}

  return {
    showTitle: typeof o.showTitle === "boolean" ? o.showTitle : DEFAULT_DEFINITION_ONLY_OPTIONS.showTitle,
    showWord: typeof o.showWord === "boolean" ? o.showWord : DEFAULT_DEFINITION_ONLY_OPTIONS.showWord,
    showPronunciation: typeof o.showPronunciation === "boolean" ? o.showPronunciation : DEFAULT_DEFINITION_ONLY_OPTIONS.showPronunciation,
    showPartOfSpeech: typeof o.showPartOfSpeech === "boolean" ? o.showPartOfSpeech : DEFAULT_DEFINITION_ONLY_OPTIONS.showPartOfSpeech,
    showTranslation: typeof o.showTranslation === "boolean" ? o.showTranslation : DEFAULT_DEFINITION_ONLY_OPTIONS.showTranslation,
    showLang: typeof o.showLang === "boolean" ? o.showLang : DEFAULT_DEFINITION_ONLY_OPTIONS.showLang,
    showDate: typeof o.showDate === "boolean" ? o.showDate : DEFAULT_DEFINITION_ONLY_OPTIONS.showDate,
    titleOverride: typeof o.titleOverride === "string" ? o.titleOverride : DEFAULT_DEFINITION_ONLY_OPTIONS.titleOverride,
  }
}

function formatLangLabel(data: WotdCardData): string | null {
  if (data.lang && data.trans_lang) {
    return `${data.lang.toUpperCase()} → ${data.trans_lang.toUpperCase()}`
  }

  if (data.lang) {
    return data.lang.toUpperCase()
  }

  return null
}

function formatPartOfSpeech(value?: string): string | null {
  if (!value) return null
  return value.toUpperCase()
}

function appendMetaLine(
  root: Gtk.Box,
  data: WotdCardData,
  showDate: boolean,
  showLang: boolean,
) {
  const bits: string[] = []

  if (showDate && data.date) bits.push(data.date)

  const lang = showLang ? formatLangLabel(data) : null
  if (lang) bits.push(lang)

  if (bits.length > 0) {
    root.append(makeLabel(bits.join("  •  "), ["wotd-compact-meta"]))
  }
}

export function createWotdCompact(
  data: WotdCardData,
  options?: WotdCompactOptions,
): Gtk.Widget {
  const o = resolveCompactOptions(options)

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  })
  root.add_css_class("wotd-compact")

  const title = o.titleOverride.trim() || data.title
  if (o.showTitle && title) {
    root.append(makeLabel(title, ["wotd-compact-title"]))
  }

  appendMetaLine(root, data, o.showDate, o.showLang)

  if (o.showWord && data.word) {
    root.append(makeLabel(data.word, ["wotd-compact-word"]))
  }

  if (o.showPronunciation && data.pronunciation) {
    root.append(makeLabel(data.pronunciation, ["wotd-compact-pronunciation"]))
  }

  if (o.showPartOfSpeech) {
    const pos = formatPartOfSpeech(data.part_of_speech)
    if (pos) {
      root.append(makeLabel(pos, ["wotd-compact-part-of-speech"]))
    }
  }

  if (o.showDefinition && data.definition) {
    root.append(makeLabel(data.definition, ["wotd-compact-definition"], true))
  }

  if (o.maxMeanings > 0 && data.meanings.length > 0) {
    const meaningsBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
    })
    meaningsBox.add_css_class("wotd-compact-meanings")

    for (const meaning of data.meanings.slice(0, o.maxMeanings)) {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
      })
      row.add_css_class("wotd-compact-meaning-row")

      row.append(makeLabel(`${meaning.index}.`, ["wotd-compact-meaning-index"]))
      row.append(makeLabel(meaning.text, ["wotd-compact-meaning-text"], true))

      meaningsBox.append(row)
    }

    root.append(meaningsBox)
  }

  if (o.showTranslations && o.maxTranslations > 0 && data.translations.length > 0) {
    const transBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
    })
    transBox.add_css_class("wotd-compact-translations")

    for (const translation of data.translations.slice(0, o.maxTranslations)) {
      transBox.append(makeLabel(`→ ${translation}`, ["wotd-compact-translation"], true))
    }

    root.append(transBox)
  }

  return root
}

export function createWotdDefinitionOnly(
  data: WotdCardData,
  options?: WotdDefinitionOnlyOptions,
): Gtk.Widget {
  const o = resolveDefinitionOnlyOptions(options)

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
  })
  root.add_css_class("wotd-definition-only")

  const title = o.titleOverride.trim() || data.title
  if (o.showTitle && title) {
    root.append(makeLabel(title, ["wotd-definition-only-title"]))
  }

  appendMetaLine(root, data, o.showDate, o.showLang)

  if (o.showWord && data.word) {
    const wordRow = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
    })
    wordRow.add_css_class("wotd-definition-only-word-row")

    wordRow.append(makeLabel(data.word, ["wotd-definition-only-word"]))

    if (o.showPartOfSpeech) {
      const pos = formatPartOfSpeech(data.part_of_speech)
      if (pos) {
        wordRow.append(makeLabel(pos, ["wotd-definition-only-part-of-speech"]))
      }
    }

    root.append(wordRow)
  }

  if (o.showPronunciation && data.pronunciation) {
    root.append(makeLabel(data.pronunciation, ["wotd-definition-only-pronunciation"]))
  }

  root.append(makeLabel(data.definition, ["wotd-definition-only-definition"], true))

  if (o.showTranslation && data.translations.length > 0) {
    root.append(
      makeLabel(`→ ${data.translations[0]}`, ["wotd-definition-only-translation"], true),
    )
  }

  return root
}
