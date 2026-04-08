import { getAppWindow } from "./windowTypes"

type ControlledWindow = {
  visible: boolean
  show(): void
  hide(): void
  openWindow?(): void
  closeWindow?(): void
}

type WindowHook<T extends ControlledWindow> = (window: T) => void

type ToggleOptions<T extends ControlledWindow> = {
  beforeOpen?: WindowHook<T>
  beforeClose?: WindowHook<T>
}

function openWindow<T extends ControlledWindow>(window: T, beforeOpen?: WindowHook<T>) {
  beforeOpen?.(window)
  if (typeof window.openWindow === "function") window.openWindow()
  else window.show()
}

function closeWindow<T extends ControlledWindow>(window: T, beforeClose?: WindowHook<T>) {
  beforeClose?.(window)
  if (typeof window.closeWindow === "function") window.closeWindow()
  else window.hide()
}

export function withWindow<T extends ControlledWindow>(name: string, callback: (window: T) => void) {
  const window = getAppWindow<T>(name)
  if (!window) return
  callback(window)
}

export function showAppWindow<T extends ControlledWindow>(name: string, beforeOpen?: WindowHook<T>) {
  withWindow<T>(name, window => openWindow(window, beforeOpen))
}

export function hideAppWindow<T extends ControlledWindow>(name: string, beforeClose?: WindowHook<T>) {
  withWindow<T>(name, window => closeWindow(window, beforeClose))
}

export function toggleAppWindow<T extends ControlledWindow>(name: string, options: ToggleOptions<T> = {}) {
  withWindow<T>(name, window => {
    if (window.visible) {
      closeWindow(window, options.beforeClose)
      return
    }
    openWindow(window, options.beforeOpen)
  })
}
