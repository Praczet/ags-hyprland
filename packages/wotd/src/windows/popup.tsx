import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

import type { WotdConfig, WotdPopupShowOptions } from "../types"
import { resolveWotdConfig } from "../config"
import { getWotdStore } from "../store"
import { createWotdCard } from "../widgets/card"
import { createWotdCompact, createWotdDefinitionOnly } from "../widgets/compact"

export const WOTD_POPUP_WINDOW_NAME = "wotd-popup"

export type WotdPopupWindowHandle = Astal.Window & {
  openWindow(options?: WotdPopupShowOptions): void
  closeWindow(): void
}

export type WotdPopupController = {
  window: WotdPopupWindowHandle
  show(options?: WotdPopupShowOptions): void
  hide(): void
  destroy(): void
}

export function createWotdPopupWindow(
  userConfig?: WotdConfig,
  monitor = 0,
): WotdPopupController {
  const config = resolveWotdConfig(userConfig)
  const store = getWotdStore(config)

  let hideTimerId: number | null = null
  let exitTimerId: number | null = null

  const content = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
  })
  content.add_css_class("wotd-popup-content")

  function render(cardType: WotdPopupShowOptions["cardType"] = config.cardType) {
    while (true) {
      const child = content.get_first_child()
      if (!child) break
      content.remove(child)
    }

    const data = store.get()

    if (!data) {
      const fallback = new Gtk.Label({
        label: "No word of the day.",
        xalign: 0,
      })
      fallback.add_css_class("wotd-popup-empty")
      content.append(fallback)
      return
    }

    if (cardType === "compact") {
      content.append(createWotdCompact(data, {
        showTitle: true,
        showDate: config.showDate,
        showLang: true,
        maxMeanings: config.maxMeanings,
        maxTranslations: config.maxTranslations,
        maxWidth: config.maxWidth,
        minHeight: config.minHeight,
      }))
      return
    }

    if (cardType === "definition-only") {
      content.append(createWotdDefinitionOnly(data, {
        showTitle: true,
        showWord: true,
        showTranslation: true,
        showPartOfSpeech: true,
        maxWidth: config.maxWidth,
        minHeight: config.minHeight,
      }))
      return
    }

    content.append(createWotdCard(data, {
      compact: true,
      showTitle: true,
      showDate: config.showDate,
      showLang: true,
      showPronunciation: true,
      showPartOfSpeech: true,
      showDefinition: true,
      showMeanings: true,
      showTranslations: config.showTranslations,
      maxMeanings: config.maxMeanings,
      maxTranslations: config.maxTranslations,
      maxWidth: config.maxWidth,
      minHeight: config.minHeight,
    }))
  }

  render(config.cardType)

  const frameWidth = config.maxWidth

  const frame = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    widthRequest: frameWidth,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.START,
    marginTop: config.popupMarginTop,
    width_request: frameWidth,
  })
  frame.add_css_class("wotd-popup")
  frame.append(content)
  frame.set_size_request(frameWidth, -1)

  const window = (
    <window
      name={WOTD_POPUP_WINDOW_NAME}
      namespace="adart-wotd"
      class="wotd-popup-window"
      visible={false}
      monitor={monitor}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.NONE}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
    >
      {frame}
    </window>
  ) as WotdPopupWindowHandle

  function clearTimers() {
    if (hideTimerId !== null) {
      GLib.Source.remove(hideTimerId)
      hideTimerId = null
    }

    if (exitTimerId !== null) {
      GLib.Source.remove(exitTimerId)
      exitTimerId = null
    }
  }

  function hideNow() {
    clearTimers()
    frame.remove_css_class("wotd-popup-visible")
    frame.remove_css_class("wotd-popup-exit")
    window.visible = false
  }

  function hide() {
    clearTimers()

    frame.remove_css_class("wotd-popup-visible")
    frame.add_css_class("wotd-popup-exit")

    exitTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 420, () => {
      exitTimerId = null
      hideNow()
      return GLib.SOURCE_REMOVE
    })
  }

  function show(options?: WotdPopupShowOptions) {
    clearTimers()

    const cardType = options?.cardType ?? config.cardType

    store.reload()
    render(cardType)

    frame.remove_css_class("wotd-popup-exit")
    frame.remove_css_class("wotd-popup-visible")

    window.visible = true

    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      frame.add_css_class("wotd-popup-visible")
      return GLib.SOURCE_REMOVE
    })

    hideTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, config.popupDurationMs, () => {
      hideTimerId = null
      hide()
      return GLib.SOURCE_REMOVE
    })
  }

  function destroy() {
    clearTimers()
    window.visible = false
    window.destroy()
  }

  window.openWindow = show
  window.closeWindow = hide

  return {
    window,
    show,
    hide,
    destroy,
  }
}
export function WotdPopupWindow(monitor = 0): Astal.Window {
  return getWotdPopup(undefined, monitor).window
}

let sharedPopup: WotdPopupController | null = null

export function getWotdPopup(userConfig?: WotdConfig, monitor = 0): WotdPopupController {
  if (!sharedPopup) {
    sharedPopup = createWotdPopupWindow(userConfig, monitor)
  }
  return sharedPopup
}

export function showWotdPopup(userConfig?: WotdConfig, monitor = 0, options?: WotdPopupShowOptions) {
  getWotdPopup(userConfig, monitor).show(options)
}

export function hideWotdPopup() {
  sharedPopup?.hide()
}

export function destroyWotdPopup() {
  if (!sharedPopup) return
  sharedPopup.destroy()
  sharedPopup = null
}
