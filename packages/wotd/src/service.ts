import GLib from "gi://GLib"
import { resolveWotdConfig } from "./config"
import type { WotdCardData, WotdConfig, WotdMeaning, WotdMeta } from "./types"

function logWotdError(err: unknown, message: string) {
  logError(err instanceof Error ? err : new Error(String(err)), message)
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeMeaning(value: unknown, fallbackIndex: number): WotdMeaning | null {
  if (!isObject(value)) return null

  const text = asNonEmptyString(value.text)
  if (!text) return null

  const rawIndex = Number(value.index)
  const index = Number.isFinite(rawIndex) ? Math.floor(rawIndex) : fallbackIndex

  return {
    index,
    text,
  }
}

function normalizeMeanings(value: unknown): WotdMeaning[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, idx) => normalizeMeaning(item, idx + 1))
    .filter((item): item is WotdMeaning => item !== null)
}

function normalizeMeta(value: unknown): WotdMeta | undefined {
  if (!isObject(value)) return undefined

  const definition_source = asNonEmptyString(value.definition_source)
  const translation_source = asNonEmptyString(value.translation_source)

  if (!definition_source && !translation_source) return undefined

  return {
    definition_source,
    translation_source,
  }
}

/**
 * Convert unknown JSON into a normalized WOTD card.
 * Returns null when the payload is not usable.
 */
export function parseWotdCard(raw: unknown): WotdCardData | null {
  if (!isObject(raw)) return null

  const kind = asString(raw.kind)
  if (kind !== "wotd-card") return null

  const date = asNonEmptyString(raw.date)
  const title = asNonEmptyString(raw.title)
  const lang = asNonEmptyString(raw.lang)
  const word = asNonEmptyString(raw.word)
  const definition = asNonEmptyString(raw.definition)

  if (!date || !title || !lang || !word || !definition) {
    return null
  }

  const meanings = normalizeMeanings(raw.meanings)

  const translationsFromArray = asStringArray(raw.translations)
  const translationSingle = asNonEmptyString(raw.translation)
  const translations = translationsFromArray.length
    ? translationsFromArray
    : translationSingle
      ? [translationSingle]
      : []

  const part_of_speech = asNonEmptyString(raw.part_of_speech)?.toLowerCase()
  const pronunciation = asNonEmptyString(raw.pronunciation)
  const word_raw = asNonEmptyString(raw.word_raw)
  const trans_lang = asNonEmptyString(raw.trans_lang)
  const meta = normalizeMeta(raw.meta)

  return {
    kind: "wotd-card",
    date,
    title,
    lang,
    trans_lang,
    word,
    word_raw,
    pronunciation,
    part_of_speech,
    definition,
    meanings,
    translations,
    meta,
  }
}

/**
 * Read and parse the configured WOTD card file.
 * Returns null if the file does not exist, cannot be read, or contains invalid JSON.
 */
export function loadWotdCard(config?: WotdConfig): WotdCardData | null {
  const resolved = resolveWotdConfig(config)

  try {
    const result = GLib.file_get_contents(resolved.cardPath)
    const bytes = result?.[1]
    if (!bytes) return null

    const text = new TextDecoder().decode(bytes)
    const raw = JSON.parse(text)

    return parseWotdCard(raw)
  } catch (err) {
    logWotdError(err, `[wotd] failed to load card from ${resolved.cardPath}`)
    return null
  }
}
