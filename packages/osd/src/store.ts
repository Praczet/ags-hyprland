import { createState } from "ags"
import GLib from "gi://GLib"
import { brightnessIcon, micIcon, volumeIcon } from "./icons"
import type { OSDKind, OSDState, ShowOSDPayload } from "./types"

const HIDE_DELAY_MS = 1600

const defaultState: OSDState = {
  kind: "volume",
  label: "Volume",
  icon: "audio-volume-medium-symbolic",
  value: 0,
  visible: false,
  monitor: 0,
  showProgress: true,
}

const [state, setState] = createState<OSDState>(defaultState)

let hideSource: number | null = null

const listeners = new Set<(snapshot: OSDState) => void>()

export function subscribeOSD(listener: (snapshot: OSDState) => void) {
  listeners.add(listener)
  listener(state())
  return () => listeners.delete(listener)
}

function notify() {
  const snapshot = state()
  listeners.forEach(listener => listener(snapshot))
}

function scheduleHide() {
  if (hideSource !== null) {
    GLib.source_remove(hideSource)
    hideSource = null
  }

  hideSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIDE_DELAY_MS, () => {
    setState({ ...state(), visible: false })
    notify()
    hideSource = null
    return GLib.SOURCE_REMOVE
  })
}

function mergePayload(payload: ShowOSDPayload) {
  const current = state()
  setState({
    ...current,
    ...payload,
    monitor: payload.monitor ?? current.monitor ?? 0,
    showProgress: payload.showProgress ?? true,
    visible: true,
  })
  notify()
  scheduleHide()
}

export const osdState = state

export function showVolumeOSD(value: number, muted: boolean, monitor?: number) {
  mergePayload({
    kind: "volume",
    label: "Volume",
    value,
    icon: volumeIcon(value, muted),
    monitor,
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

export function showGenericOSD(payload: { icon: string; label: string; value: number | null; monitor?: number; showProgress?: boolean }) {
  mergePayload({
    kind: "custom",
    label: payload.label,
    value: payload.value,
    icon: payload.icon,
    monitor: payload.monitor,
    showProgress: payload.showProgress,
  })
}
