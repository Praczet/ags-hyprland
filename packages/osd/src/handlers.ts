import { showBrightnessOSD, showGenericOSD, showMicOSD, showVolumeOSD } from "./store"
import { readDefaultSink, readDefaultSource } from "./services/audio"
import { readBrightnessPercent } from "./services/brightness"
import { getActiveMonitor } from "./services/hypr"
import { PlayerCtlAction, PlayerTriggerData, TriggerOptions, TriggerType } from "./types"
import { execAsync } from "ags/process"
import { readMeta, readMetaFresh } from "./services/player"

async function resolveMonitor(): Promise<number> {
  return await getActiveMonitor()
}

export async function triggerVolume(value?: number | string | null, muted?: boolean) {
  let val = value
  let isMuted = muted ?? false
  if (val === undefined || val === null) {
    const sink = await readDefaultSink()
    val = sink?.value ?? 0
    isMuted = sink?.muted ?? false
  }
  const monitor = await resolveMonitor()
  showVolumeOSD(typeof val === "number" ? val : 0, isMuted, monitor)
}

export async function triggerMic(value?: string | number | null, muted?: boolean) {
  let val = value
  let isMuted = muted ?? false
  if (val === undefined || val === null || typeof val === "string") {
    const source = await readDefaultSource()
    val = source?.value ?? 0
    isMuted = source?.muted ?? false
  }
  const monitor = await resolveMonitor()
  showMicOSD(val ?? 0, isMuted, monitor)
}

export async function triggerBrightness(value?: string | number | null) {
  let val = value
  if (val === undefined || val === null) {
    val = await readBrightnessPercent()
  }
  if (val === null || val === undefined || typeof val === "string") return
  const monitor = await resolveMonitor()
  showBrightnessOSD(val, monitor)
}

export async function triggerCustom(icon: string, label: string, value?: string | number | null, showProgress = false) {
  const monitor = await resolveMonitor()
  showGenericOSD({ icon, label, value: value ?? null, monitor, showProgress })
}

/* ---------------- Playerctl ---------------- */

export async function triggerPlayerCtl(action: PlayerCtlAction) {
  try {
    const before = await readMeta()
    // 1. Perform action
    // await playerCtl(action)

    // 2. Always re-read metadata AFTER the action
    const meta =
      action === "next" || action === "prev"
        ? await readMetaFresh(before, 10, 90)
        : await readMeta()

    // 3. Prepare semantic payload
    const data: PlayerTriggerData = {
      action,
      meta,
    }

    // 4. (Optional but recommended) show OSD
    const monitor = await getActiveMonitor()
    let icon = "media-playback-start-symbolic";


    if (meta) {
      switch (action) {
        case "pause":
        case "play-pause":
        case "play": {
          icon = meta.playbackStatus === "Playing"
            ? "media-playback-start-symbolic"
            : "media-playback-pause-symbolic"
          break;
        }
        case "next": {
          icon = "media-skip-forward-symbolic"
          break;
        }
        case "prev": {
          icon = "media-skip-backward-symbolic"
          break;
        }

      }
      showGenericOSD({
        icon: icon,
        label: `${meta.title}`,
        value: meta.artist,
        monitor,
        showProgress: false,
      })
    }

    return data
  } catch (error) {
    console.error("OSD triggerPlayerCtl error", error)
    return null
  }
}

/* ---------------- Dispatch ---------------- */


async function dispatch(type: TriggerType | string, options: TriggerOptions = {}) {
  const normalized = type.toLowerCase() as TriggerType

  switch (normalized) {
    case "volume":
      await triggerVolume(options.value, options.muted)
      return

    case "mic":
      await triggerMic(options.value, options.muted)
      return

    case "brightness":
      await triggerBrightness(options.value)
      return

    case "custom":
      if (!options.icon || !options.label) return
      await triggerCustom(
        options.icon,
        options.label,
        options.value ?? null,
        options.showProgress
      )
      return

    case "playerctl": {
      const data = options.data as PlayerTriggerData | undefined
      if (!data?.action) return
      await triggerPlayerCtl(data.action)
      return
    }

    default:
      console.warn("Unknown OSD trigger", type)
  }
}

export function registerOSDHandlers() {
  const api = {
    volume: triggerVolume,
    mic: triggerMic,
    brightness: triggerBrightness,
    custom: triggerCustom,
    playerctl: triggerPlayerCtl,
    dispatch,
  }
  const root = globalThis as Record<string, unknown>
  root["osd"] = api
  root["osdVolume"] = triggerVolume
  root["osdMic"] = triggerMic
  root["osdBrightness"] = triggerBrightness
  root["osdCustom"] = triggerCustom
  root["osdPlayerCtl"] = triggerPlayerCtl
  root["osdTrigger"] = dispatch
}
