import { triggerBrightness, triggerCustom, triggerMic, triggerVolume } from "../packages/osd/src"
import { triggerPlayerCtl } from "../packages/osd/src/handlers"
import { PlayerCtlAction } from "../packages/osd/src/types"

export function parseNumber(value?: string) {
  if (value === undefined) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export async function osdHandleRequest(argv: string[]): Promise<string> {
  const [cmd, ...rest] = argv
  if (!cmd) return "missing command"
  try {
    switch (cmd.toLowerCase()) {
      case "osdvolume":
      case "osd_volume":
        {
          const value = parseNumber(rest[0])
          const muted = rest[1] ? rest[1].toLowerCase() === "true" : undefined
          await triggerVolume(value, muted)
          return "ok"
        }
      case "osdmic":
        {
          const value = parseNumber(rest[0])
          const muted = rest[1] ? rest[1].toLowerCase() === "true" : undefined
          await triggerMic(value, muted)
          return "ok"
        }
      case "osdbrightness":
        {
          const value = parseNumber(rest[0])
          await triggerBrightness(value)
          return "ok"
        }
      case "osdcustom":
        {
          const icon = rest[0]
          const label = rest[1]
          if (!icon || !label) return "usage: osdCustom <icon> <label> [value] [showProgress]"
          const value = parseNumber(rest[2]) ?? null
          const showProgress = rest[3] ? rest[3].toLowerCase() === "true" : false
          await triggerCustom(icon, label, value, showProgress)
          return "ok"
        }
      case "osdplayerctl":
      case "osd_playerctl":
      case "osdplayer":
      case "osd_player":
        {
          const raw = (rest[0] ?? "").toLowerCase()
          if (!raw) return "usage: osdPlayerCtl <pause|play|play-pause|next|prev>"

          // Validate action
          const allowed: PlayerCtlAction[] = ["pause", "play", "play-pause", "next", "prev"]
          if (!allowed.includes(raw as PlayerCtlAction)) {
            return "usage: osdPlayerCtl <pause|play|play-pause|next|prev>"
          }

          await triggerPlayerCtl(raw as PlayerCtlAction)
          return "ok"
        }
      default:
        return `unknown command: ${cmd}`
    }
  } catch (error) {
    console.error("OSD request error", error)
    return `error: ${error}`
  }
}
