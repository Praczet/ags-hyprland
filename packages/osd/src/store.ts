// store.ts
import { createState } from "ags"
import { brightnessIcon, micIcon, volumeIcon } from "./icons"
import type { OSDState, ShowOSDPayload } from "./types"
import { timeout } from "ags/time"

const HIDE_DELAY_MS = 3600

const defaultState: OSDState = {
  kind: "volume",
  label: "Volume",
  icon: "audio-volume-medium-symbolic",
  value: 0,
  visible: false,
  monitor: 0,
  showProgress: true,
}

// Accessor + setter
export const [osdState, setOSDState] = createState<OSDState>(defaultState)

// Timer handle (type depends on AGS; keep it flexible)
let hideTimer: any = null

function cancelHide() {
  if (!hideTimer) return
  // be defensive across possible Timer implementations
  hideTimer.cancel?.()
  hideTimer.stop?.()
  hideTimer.destroy?.()
  hideTimer = null
}

function scheduleHide() {
  cancelHide()
  hideTimer = timeout(HIDE_DELAY_MS, () => {
    setOSDState({ ...osdState.peek(), visible: false })
    hideTimer = null
  })
}

function mergePayload(payload: ShowOSDPayload) {
  const current = osdState.peek()
  setOSDState({
    ...current,
    ...payload,
    monitor: payload.monitor ?? current.monitor ?? 0,
    showProgress: payload.showProgress ?? true,
    visible: true,
  })
  scheduleHide()
}

export function showVolumeOSD(value: number, muted: boolean, monitor?: number) {
  mergePayload({
    kind: "volume",
    label: "Volume",
    value,
    icon: volumeIcon(value, muted),
    monitor,
    muted,
  })
}

export function showMicOSD(value: number, muted: boolean, monitor?: number) {
  mergePayload({
    kind: "mic",
    label: "Microphone",
    value,
    icon: micIcon(muted),
    monitor,
  })
}

export function showBrightnessOSD(value: number, monitor?: number) {
  mergePayload({
    kind: "brightness",
    label: "Brightness",
    value,
    icon: brightnessIcon(value),
    monitor,
  })
}

export function showGenericOSD(payload: {
  icon: string
  label: string
  value: number | string | null
  monitor?: number
  showProgress?: boolean
}) {
  mergePayload({
    kind: "custom",
    label: payload.label,
    value: payload.value,
    icon: payload.icon,
    monitor: payload.monitor,
    showProgress: payload.showProgress,
  })
}

