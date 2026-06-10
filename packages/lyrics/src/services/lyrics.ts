import Gio from "gi://Gio"
import GLib from "gi://GLib"

import type { LyricsTrack, ResolvedLyricsConfig } from "../types"
import { runCommand } from "../../../../shared/utils/process"

type LrclibResponse = {
  syncedLyrics?: string | null
}

function slugPart(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "unknown"
}

export function cachePathForTrack(track: LyricsTrack, config: ResolvedLyricsConfig) {
  return `${config.cacheDir}/${slugPart(track.artist)}--${slugPart(track.title)}.lrc`
}

function ensureCacheDir(config: ResolvedLyricsConfig) {
  GLib.mkdir_with_parents(config.cacheDir, 0o755)
}

export function readCachedLyrics(track: LyricsTrack, config: ResolvedLyricsConfig): string | null {
  try {
    ensureCacheDir(config)
    const file = Gio.File.new_for_path(cachePathForTrack(track, config))
    if (!file.query_exists(null)) return null
    const [, contents] = file.load_contents(null)
    return new TextDecoder().decode(contents)
  } catch (err) {
    console.error("[lyrics] failed to read cached lyrics", err)
    return null
  }
}

function writeCachedLyrics(track: LyricsTrack, config: ResolvedLyricsConfig, lyrics: string) {
  try {
    ensureCacheDir(config)
    GLib.file_set_contents(cachePathForTrack(track, config), lyrics)
  } catch (err) {
    console.error("[lyrics] failed to write cached lyrics", err)
  }
}

export async function fetchSyncedLyrics(track: LyricsTrack, config: ResolvedLyricsConfig): Promise<string | null> {
  if (!config.lookupOnMissing) return null

  try {
    const args = [
      "curl",
      "-fsSLG",
      "https://lrclib.net/api/get",
      "-H",
      "User-Agent: AGS-Adart-Lyrics/0.1 (local Hyprland AGS widget)",
      "--data-urlencode",
      `track_name=${track.title}`,
      "--data-urlencode",
      `artist_name=${track.artist}`,
      "--data-urlencode",
      `album_name=${track.album}`,
    ]

    if (track.duration > 0) {
      args.push("--data-urlencode", `duration=${track.duration}`)
    }

    const output = await runCommand(args)
    const parsed = JSON.parse(output) as LrclibResponse
    const syncedLyrics = parsed.syncedLyrics?.trim()

    if (!syncedLyrics) return null
    writeCachedLyrics(track, config, syncedLyrics)
    return syncedLyrics
  } catch (err) {
    console.error("[lyrics] LRCLIB lookup failed", err)
    return null
  }
}

export async function loadLyricsForTrack(track: LyricsTrack, config: ResolvedLyricsConfig): Promise<string | null> {
  const cached = readCachedLyrics(track, config)
  if (cached?.trim()) return cached
  return fetchSyncedLyrics(track, config)
}
