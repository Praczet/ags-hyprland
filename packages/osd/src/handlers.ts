import { showBrightnessOSD, showGenericOSD, showMicOSD, showVolumeOSD } from "./store"
import { readDefaultSink, readDefaultSource } from "./services/audio"
import { readBrightnessPercent } from "./services/brightness"
import { getActiveMonitor } from "./services/hypr"

async function resolveMonitor(): Promise<number> {
  return await getActiveMonitor()
}

export async function triggerVolume(value?: number | null, muted?: boolean) {
  let val = value
  let isMuted = muted ?? false
  if (val === undefined || val === null) {
    const sink = await readDefaultSink()
    val = sink?.value ?? 0
    isMuted = sink?.muted ?? false
  }
  const monitor = await resolveMonitor()
  showVolumeOSD(val ?? 0, isMuted, monitor)
}

export async function triggerMic(value?: number | null, muted?: boolean) {
  let val = value
  let isMuted = muted ?? false
  if (val === undefined || val === null) {
    const source = await readDefaultSource()
    val = source?.value ?? 0
    isMuted = source?.muted ?? false
  }
  const monitor = await resolveMonitor()
  showMicOSD(val ?? 0, isMuted, monitor)
}

export async function triggerBrightness(value?: number | null) {
  let val = value
  if (val === undefined || val === null) {
    val = await readBrightnessPercent()
  }
  if (val === null || val === undefined) return
  const monitor = await resolveMonitor()
  showBrightnessOSD(val, monitor)
}

export async function triggerCustom(icon: string, label: string, value?: number | null, showProgress = false) {
  const monitor = await resolveMonitor()
  showGenericOSD({ icon, label, value: value ?? null, monitor, showProgress })
}

type TriggerType = "volume" | "mic" | "brightness" | "custom"

type TriggerOptions = {
  value?: number | null
  muted?: boolean
  icon?: string
  label?: string
  showProgress?: boolean
}

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
      await triggerCustom(options.icon, options.label, options.value ?? null, options.showProgress)
      return
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
    dispatch,
  }
  const root = globalThis as Record<string, unknown>
  root["osd"] = api
  root["osdVolume"] = triggerVolume
  root["osdMic"] = triggerMic
  root["osdBrightness"] = triggerBrightness
  root["osdCustom"] = triggerCustom
  root["osdTrigger"] = dispatch
}
