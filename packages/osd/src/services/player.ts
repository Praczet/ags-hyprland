import { execAsync } from "ags/process"
import { PlayerMetadata } from "../types";
import { timeout } from "ags/time";

const CMD_STATUS = ["playerctl", "status"]
const CMD_META = ["playerctl", "metadata"]

export function parseStatus(output: string): number | null {
  const status = output.trim()
  if (status === "Playing") return 1;
  if (status === "Paused") return 0;
  return null;
}

let defaultMetadata: PlayerMetadata = {
  title: "",
  artist: "",
  playbackDevice: "",
  playbackStatus: "Stopped"
};



export function parseMetadata(output: string): PlayerMetadata | null {
  const lines = output.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  // Start with defaults
  const meta: PlayerMetadata = {
    playbackDevice: "",
    title: "",
    artist: "",
    playbackStatus: "Stopped",
  }

  let playerName: string | null = null

  for (const line of lines) {
    // Split only into 3 parts: player, key, value
    const match = line.match(/^(\S+)\s+(\S+)\s+(.*)$/)
    if (!match) continue

    const [, player, key, rawValue] = match
    const value = rawValue.trim()

    // Use first seen player as playbackDevice
    if (!playerName) {
      playerName = player
      meta.playbackDevice = player
    }

    // Ignore metadata from other players (if any)
    if (player !== playerName) continue

    switch (key) {
      case "xesam:title":
        meta.title = value
        break

      case "xesam:artist":
        // Can be "Artist" or "['Artist']" depending on backend
        meta.artist = normalizeArtist(value)
        break

      case "xesam:album":
        if (value !== "") meta.album = value
        break

      case "mpris:artUrl":
        meta.artworkUrl = value
        break

      default:
        // ignore unknown keys
        break
    }
  }

  // If we got no meaningful data, treat as no metadata
  if (!meta.title && !meta.artist && !meta.artworkUrl) {
    return null
  }

  return meta
}

function normalizeArtist(value: string): string {
  // Already plain
  if (!value.startsWith("["))
    return value

  // Try to parse array-like string: ['Artist'] or ["Artist"]
  try {
    const parsed = JSON.parse(
      value
        .replace(/'/g, '"') // single → double quotes
    )

    if (Array.isArray(parsed)) {
      return parsed.join(", ")
    }
  } catch {
    // fall through
  }

  return value
}


export async function readPlayingStatus(): Promise<number | null> {
  try {
    const output = await execAsync(CMD_STATUS)
    return parseStatus(output)
  } catch (error) {
    console.error("OSD readPlayingStatus error", error)
    return null
  }
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => {
    timeout(ms, () => {
      resolve()
      return false
    })
  })
}

function metaKey(m: PlayerMetadata | null): string {
  if (!m) return ""
  return `${m.playbackDevice}|${m.title}|${m.artist}|${m.album ?? ""}|${m.artworkUrl ?? ""}`
}

export async function readMetaFresh(
  prev: PlayerMetadata | null,
  tries = 8,
  delayMs = 80,
): Promise<PlayerMetadata | null> {
  const prevKey = metaKey(prev)

  for (let i = 0; i < tries; i++) {
    const m = await readMeta()
    if (metaKey(m) !== prevKey && m?.title) return m
    await sleep(delayMs)
  }

  // fallback: return whatever we have after retries
  return await readMeta()
}

export async function readMeta(): Promise<PlayerMetadata | null> {
  try {
    const status = await readPlayingStatus()
    if (status === null) {
      return null
    }
    const output = await execAsync(CMD_META)
    const metadata = parseMetadata(output)
    if (metadata) {
      metadata.playbackStatus = status === 1 ? "Playing" : status === 0 ? "Paused" : "Stopped"
    }
    return metadata
  } catch (error) {
    console.error("OSD readPlayingStatus error", error)
    return null
  }
}
