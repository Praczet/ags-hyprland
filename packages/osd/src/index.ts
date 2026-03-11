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
export { showGenericOSD } from "./store"
export { triggerVolume, triggerMic, triggerBrightness, triggerCustom }
