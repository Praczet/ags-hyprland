import { hideAppWindow, showAppWindow, toggleAppWindow } from "./windowControl"
import { type LyricsAppWindow, type RequestResponse, WINDOW_NAME } from "./windowTypes"
import { getLyricsStore } from "../packages/lyrics/src"
import { getAppWindow } from "./windowTypes"

export async function lyricsHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd] = argv
  if (!cmd) return undefined

  switch (cmd.toLowerCase()) {
    case "lyrics":
    case "lyricsshow":
    case "lyrics-show": {
      showAppWindow<LyricsAppWindow>(WINDOW_NAME.lyrics)
      return "ok"
    }
    case "lyricshide":
    case "lyrics-hide": {
      hideAppWindow<LyricsAppWindow>(WINDOW_NAME.lyrics)
      return "ok"
    }
    case "togglelyrics":
    case "lyricstoggle":
    case "lyrics-toggle": {
      toggleAppWindow<LyricsAppWindow>(WINDOW_NAME.lyrics)
      return "ok"
    }
    case "lyricsstatus":
    case "lyrics-status": {
      const window = getAppWindow<LyricsAppWindow>(WINDOW_NAME.lyrics)
      const state = getLyricsStore().get()
      return JSON.stringify({
        visible: window?.visible ?? false,
        track: state.track
          ? {
            artist: state.track.artist,
            title: state.track.title,
            status: state.track.status,
            position: state.track.position,
          }
          : null,
        loading: state.loading,
        lines: state.lines.length,
        activeIndex: state.activeIndex,
        message: state.message,
        cachePath: state.cachePath,
      })
    }
  }

  return undefined
}
