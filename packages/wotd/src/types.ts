export type WotdMeaning = {
  index: number
  text: string
}

export type WotdMeta = {
  definition_source?: string
  translation_source?: string
}

export type WotdCardData = {
  kind: "wotd-card"
  date: string
  title: string

  lang: string
  trans_lang?: string

  word: string
  word_raw?: string

  pronunciation?: string
  part_of_speech?: string

  definition: string
  meanings: WotdMeaning[]
  translations: string[]

  meta?: WotdMeta
}

export type WotdConfig = {
  cardPath?: string
  cardType?: "card" | "compact" | "definition-only"
  maxWidth?: number
  minHeight?: number
  popupDurationMs?: number
  popupWidth?: number
  popupMarginTop?: number
  maxMeanings?: number
  maxTranslations?: number
  showTranslations?: boolean
  showDate?: boolean
}

export type WotdListener = (card: WotdCardData | null) => void

export type WotdStore = {
  get(): WotdCardData | null
  reload(): WotdCardData | null
  subscribe(listener: WotdListener): () => void
  startWatching(): void
  stopWatching(): void
  destroy(): void
}

export type WotdCardOptions = {
  showTitle?: boolean
  showDate?: boolean
  showLang?: boolean
  showPronunciation?: boolean
  showPartOfSpeech?: boolean
  showDefinition?: boolean
  showMeanings?: boolean
  showTranslations?: boolean
  maxMeanings?: number
  maxTranslations?: number
  maxWidth?: number
  minHeight?: number
  compact?: boolean
  titleOverride?: string
}



export type WotdCompactOptions = {
  showTitle?: boolean
  showWord?: boolean
  showPronunciation?: boolean
  showPartOfSpeech?: boolean
  showDefinition?: boolean
  showTranslations?: boolean
  showLang?: boolean
  showDate?: boolean
  maxMeanings?: number
  maxTranslations?: number
  maxWidth?: number
  minHeight?: number
  titleOverride?: string
}

export type WotdDefinitionOnlyOptions = {
  showTitle?: boolean
  showWord?: boolean
  showPronunciation?: boolean
  showPartOfSpeech?: boolean
  showTranslation?: boolean
  showLang?: boolean
  showDate?: boolean
  maxWidth?: number
  minHeight?: number
  titleOverride?: string
}

export type WotdPopupShowOptions = {
  cardType?: "card" | "compact" | "definition-only"
}
