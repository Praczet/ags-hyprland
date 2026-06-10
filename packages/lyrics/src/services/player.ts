import type { LyricsTrack } from "../types"
import { runCommand } from "../../../../shared/utils/process"

const FIELD_SEPARATOR = "::adart-lyrics::"

export type PlaybackState = Pick<LyricsTrack, "position" | "status">

async function readMetadataFields(): Promise<string[]> {
  const format = [
    "{{playerName}}",
    "{{title}}",
    "{{artist}}",
    "{{album}}",
    "{{mpris:length}}",
  ].join(FIELD_SEPARATOR)

  const output = await runCommand(["playerctl", "metadata", "--format", format])
  return output.trim().split(FIELD_SEPARATOR)
}

async function readPosition(): Promise<number> {
  const output = await runCommand(["playerctl", "position"])
  const value = Number(output.trim())
  return Number.isFinite(value) ? value : 0
}

async function readStatus(): Promise<LyricsTrack["status"]> {
  const output = (await runCommand(["playerctl", "status"])).trim()
  if (output === "Playing" || output === "Paused") return output
  return "Stopped"
}

function parseDuration(value: string): number {
  const micros = Number(value.trim())
  if (!Number.isFinite(micros) || micros <= 0) return 0
  return Math.round(micros / 1_000_000)
}

export async function readCurrentTrack(): Promise<LyricsTrack | null> {
  try {
    const [[player = "", title = "", artist = "", album = "", length = ""], playback] = await Promise.all([
      readMetadataFields(),
      readPlaybackState(),
    ])

    if (!playback) return null
    if (!title && !artist) return null

    return {
      player,
      title,
      artist,
      album,
      duration: parseDuration(length),
      position: playback.position,
      status: playback.status,
    }
  } catch {
    return null
  }
}

export async function readPlaybackState(): Promise<PlaybackState | null> {
  try {
    const [position, status] = await Promise.all([
      readPosition(),
      readStatus(),
    ])

    return {
      position,
      status,
    }
  } catch {
    return null
  }
}

export function trackKey(track: LyricsTrack | null): string {
  if (!track) return ""
  return `${track.artist}|${track.title}|${track.album}|${track.duration}`
}
