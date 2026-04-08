import { createState } from "ags"
import { timeout } from "ags/time"
import { brightnessIcon, micIcon, volumeIcon } from "./icons"
import type { OSDState, ShowOSDPayload } from "./types"

const HIDE_DELAY_MS = 1500

const defaultState: OSDState = {
  kind: "volume",
  label: "Volume",
  icon: "audio-volume-medium-symbolic",
  value: 0,
  visible: false,
  monitor: 0,
  showProgress: true,
}

export const [osdState, setOSDState] = createState<OSDState>(defaultState)

type TimerHandle = {
  cancel?(): void
  stop?(): void
  destroy?(): void
}

let hideTimer: TimerHandle | null = null

function cancelHide() {
  if (!hideTimer) return
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
