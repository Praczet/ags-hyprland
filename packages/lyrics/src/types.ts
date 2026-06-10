export type LyricsAnchor = "top" | "bottom" | "left" | "right" | "center"

export type LyricsConfig = {
  cacheDir?: string
  refreshMs?: number
  positionRefreshMs?: number
  metadataRefreshMs?: number
  lookupOnMissing?: boolean
  maxLines?: number
  width?: number
  monitor?: number
  opacity?: number
  position?: LyricsAnchor[]
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
}

export type ResolvedLyricsConfig = Required<LyricsConfig>

export type LyricsTrack = {
  player: string
  title: string
  artist: string
  album: string
  duration: number
  position: number
  status: "Playing" | "Paused" | "Stopped"
}

export type LyricLine = {
  time: number
  text: string
}

export type LyricsState = {
  track: LyricsTrack | null
  lines: LyricLine[]
  activeIndex: number
  loading: boolean
  message: string
  cachePath: string | null
}

export type LyricsListener = (state: LyricsState) => void

export type LyricsStore = {
  get(): LyricsState
  subscribe(listener: LyricsListener): () => void
  start(): void
  stop(): void
  refresh(): void
  destroy(): void
}
