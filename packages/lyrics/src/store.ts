import GLib from "gi://GLib"

import { resolveLyricsConfig } from "./config"
import type { LyricLine, LyricsConfig, LyricsListener, LyricsState, LyricsStore, ResolvedLyricsConfig } from "./types"
import { loadLyricsForTrack, cachePathForTrack } from "./services/lyrics"
import { findActiveLine, parseLrc } from "./services/lrc"
import { readCurrentTrack, readPlaybackState, trackKey } from "./services/player"

const EMPTY_STATE: LyricsState = {
  track: null,
  lines: [],
  activeIndex: -1,
  loading: false,
  message: "No player.",
  cachePath: null,
}

function windowLines(lines: LyricLine[], activeIndex: number, maxLines: number) {
  if (lines.length <= maxLines || activeIndex < 0) return lines

  if (maxLines === 3) {
    const start = Math.max(0, Math.min(activeIndex - 1, lines.length - 3))
    return lines.slice(start, start + 3)
  }

  const before = Math.floor((maxLines - 1) / 2)
  const start = Math.max(0, Math.min(activeIndex - before, lines.length - maxLines))
  return lines.slice(start, start + maxLines)
}

export function getVisibleLines(state: LyricsState, config: ResolvedLyricsConfig) {
  return windowLines(state.lines, state.activeIndex, config.maxLines)
}

export function createLyricsStore(userConfig?: LyricsConfig): LyricsStore {
  const config = resolveLyricsConfig(userConfig)
  const listeners = new Set<LyricsListener>()

  let state: LyricsState = { ...EMPTY_STATE }
  let metadataTimerId: number | null = null
  let positionTimerId: number | null = null
  let lyricTimerId: number | null = null
  let metadataRefreshRunning = false
  let positionRefreshRunning = false
  let loadingKey = ""
  let loadedKey = ""

  function emit() {
    for (const listener of listeners) {
      try {
        listener(state)
      } catch (err) {
        console.error("[lyrics] listener failed", err)
      }
    }
  }

  function setState(next: Partial<LyricsState>) {
    state = { ...state, ...next }
    emit()
  }

  function clearTimer(timerId: number | null) {
    if (timerId !== null) GLib.Source.remove(timerId)
  }

  function clearLyricTimer() {
    clearTimer(lyricTimerId)
    lyricTimerId = null
  }

  function scheduleNextLine() {
    clearLyricTimer()

    const track = state.track
    if (!track || track.status !== "Playing") return
    if (state.lines.length === 0) return

    const nextLine = state.activeIndex < 0 ? state.lines[0] : state.lines[state.activeIndex + 1]
    if (!nextLine) return

    const delayMs = Math.round((nextLine.time - track.position) * 1000)
    if (delayMs <= 30) return

    lyricTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.min(delayMs, 30_000), () => {
      lyricTimerId = null
      void refreshPosition()
      return GLib.SOURCE_REMOVE
    })
  }

  function updatePlaybackPosition(position: number, status = state.track?.status ?? "Stopped") {
    const track = state.track
    if (!track) return

    const nextTrack = { ...track, position, status }
    const activeIndex = findActiveLine(state.lines, position)

    setState({
      track: nextTrack,
      activeIndex,
    })

    scheduleNextLine()
  }

  async function loadForCurrentTrack(key: string) {
    const track = state.track
    if (!track || loadingKey === key || loadedKey === key) return

    loadingKey = key
    setState({
      loading: true,
      lines: [],
      activeIndex: -1,
      message: "Looking for synced lyrics.",
      cachePath: cachePathForTrack(track, config),
    })

    const text = await loadLyricsForTrack(track, config)
    if (trackKey(state.track) !== key) return

    const lines = text ? parseLrc(text) : []
    loadedKey = key
    loadingKey = ""

    setState({
      loading: false,
      lines,
      activeIndex: findActiveLine(lines, track.position),
      message: lines.length > 0 ? "" : "No synced lyrics found.",
      cachePath: cachePathForTrack(track, config),
    })
    scheduleNextLine()
  }

  async function refreshMetadata() {
    if (metadataRefreshRunning) return
    metadataRefreshRunning = true

    const track = await readCurrentTrack()
    metadataRefreshRunning = false

    if (!track) {
      loadedKey = ""
      loadingKey = ""
      clearLyricTimer()
      setState({ ...EMPTY_STATE })
      return
    }

    const key = trackKey(track)
    const changed = key !== trackKey(state.track)

    if (changed) {
      loadedKey = ""
      setState({
        track,
        lines: [],
        activeIndex: -1,
        loading: false,
        message: "Looking for synced lyrics.",
        cachePath: cachePathForTrack(track, config),
      })
      void loadForCurrentTrack(key)
      return
    }

    updatePlaybackPosition(track.position, track.status)
  }

  async function refreshPosition() {
    if (positionRefreshRunning) return

    if (!state.track) {
      await refreshMetadata()
      return
    }

    positionRefreshRunning = true
    const playback = await readPlaybackState()
    positionRefreshRunning = false

    if (!playback) {
      await refreshMetadata()
      return
    }

    updatePlaybackPosition(playback.position, playback.status)
  }

  function start() {
    if (metadataTimerId !== null || positionTimerId !== null) return

    void refreshMetadata()
    metadataTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, config.metadataRefreshMs, () => {
      void refreshMetadata()
      return GLib.SOURCE_CONTINUE
    })

    positionTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, config.positionRefreshMs, () => {
      void refreshPosition()
      return GLib.SOURCE_CONTINUE
    })
  }

  function stop() {
    clearTimer(metadataTimerId)
    clearTimer(positionTimerId)
    clearLyricTimer()
    metadataTimerId = null
    positionTimerId = null
  }

  function destroy() {
    stop()
    listeners.clear()
  }

  function subscribe(listener: LyricsListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get: () => state,
    subscribe,
    start,
    stop,
    refresh: () => void refreshMetadata(),
    destroy,
  }
}

let sharedStore: LyricsStore | null = null

export function getLyricsStore(config?: LyricsConfig): LyricsStore {
  if (!sharedStore) sharedStore = createLyricsStore(config)
  return sharedStore
}

export function destroyLyricsStore() {
  sharedStore?.destroy()
  sharedStore = null
}
