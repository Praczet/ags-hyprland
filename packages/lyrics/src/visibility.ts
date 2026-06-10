import Gio from "gi://Gio"
import GLib from "gi://GLib"

const VISIBILITY_PATH = `${GLib.get_user_runtime_dir()}/adart-lyrics-visible`

export function setLyricsVisiblePreference(visible: boolean) {
  try {
    if (visible) {
      GLib.file_set_contents(VISIBILITY_PATH, "1")
      return
    }

    const file = Gio.File.new_for_path(VISIBILITY_PATH)
    if (file.query_exists(null)) file.delete(null)
  } catch (err) {
    console.error("[lyrics] failed to store visibility preference", err)
  }
}

export function getLyricsVisiblePreference() {
  try {
    return Gio.File.new_for_path(VISIBILITY_PATH).query_exists(null)
  } catch {
    return false
  }
}
