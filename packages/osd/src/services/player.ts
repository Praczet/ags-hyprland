import { timeout } from "ags/time"
import type { PlayerMetadata } from "../types"
import { logProcessError, runCommand } from "../../../../shared/utils/process"

const CMD_STATUS = ["playerctl", "status"]
const CMD_META = ["playerctl", "metadata"]

export function parseStatus(output: string): number | null {
  const status = output.trim()
  if (status === "Playing") return 1
  if (status === "Paused") return 0
  return null
}

export function parseMetadata(output: string): PlayerMetadata | null {
  const lines = output.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const meta: PlayerMetadata = {
    playbackDevice: "",
    title: "",
    artist: "",
    playbackStatus: "Stopped",
  }

  let playerName: string | null = null

  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\S+)\s+(.*)$/)
    if (!match) continue

    const [, player, key, rawValue] = match
    const value = rawValue.trim()

    if (!playerName) {
      playerName = player
      meta.playbackDevice = player
    }

    if (player !== playerName) continue

    switch (key) {
      case "xesam:title":
        meta.title = value
        break

      case "xesam:artist":
        meta.artist = normalizeArtist(value)
        break

      case "xesam:album":
        if (value !== "") meta.album = value
        break

      case "mpris:artUrl":
        meta.artworkUrl = value
        break

      default:
        break
    }
  }

  if (!meta.title && !meta.artist && !meta.artworkUrl) {
    return null
  }

  return meta
}

function normalizeArtist(value: string): string {
  if (!value.startsWith("[")) return value

  try {
    const parsed = JSON.parse(
      value.replace(/'/g, '"')
    )

    if (Array.isArray(parsed)) {
      return parsed.join(", ")
    }
  } catch {
    return value
  }

  return value
}

export async function readPlayingStatus(): Promise<number | null> {
  try {
    const output = await runCommand(CMD_STATUS)
    return parseStatus(output)
  } catch (error) {
    logProcessError("OSD readPlayingStatus error", error)
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

  return await readMeta()
}

export async function readMeta(): Promise<PlayerMetadata | null> {
  try {
    const status = await readPlayingStatus()
    if (status === null) {
      return null
    }
    const output = await runCommand(CMD_META)
    const metadata = parseMetadata(output)
    if (metadata) {
      metadata.playbackStatus = status === 1 ? "Playing" : status === 0 ? "Paused" : "Stopped"
    }
    return metadata
  } catch (error) {
    logProcessError("OSD readMeta error", error)
    return null
  }
}
