import css from "./styles.css"
import { OSDWindow } from "./windows/OSDWindow"
import { registerOSDHandlers, triggerBrightness, triggerCustom, triggerMic, triggerVolume } from "./handlers"

let started = false

export function initOSD() {
  if (started) return
  started = true
  registerOSDHandlers()
}

export { OSDWindow, css }
export { OSD_WINDOW_NAME } from "./windows/OSDWindow"
export type { OSDWindowHandle } from "./windows/OSDWindow"
export { showGenericOSD } from "./store"
export { triggerVolume, triggerMic, triggerBrightness, triggerCustom }
