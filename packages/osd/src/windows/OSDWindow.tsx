import { Astal, Gtk } from "ags/gtk4"
import type { OSDState } from "../types"
import { subscribeOSD } from "../store"

export function OSDWindow(defaultMonitor = 0) {
  let winRef: Astal.Window | null = null
  let cardRef: Gtk.Box | null = null
  let iconRef: Gtk.Image | null = null
  let labelRef: Gtk.Label | null = null
  let valueRef: Gtk.Label | null = null
  let levelRef: Gtk.LevelBar | null = null
  let pendingState: OSDState | null = null

  const applyState = (state: OSDState) => {
    if (!cardRef || !iconRef || !labelRef || !valueRef) {
      pendingState = state
      return
    }
    pendingState = null

    iconRef.set_from_icon_name(state.icon)
    labelRef.set_label(state.label)
    if (state.value !== null) {
      valueRef.set_label(`${state.value}%`)
      levelRef?.set_value(state.value)
    } else {
      valueRef.set_label("")
    }

    const showProgress = !!state.showProgress && state.value !== null
    if (levelRef) {
      levelRef.set_visible(showProgress)
      if (showProgress && state.value !== null) {
        levelRef.set_value(state.value)
      }
    }

    if (state.visible) {
      cardRef.remove_css_class("osd-card-hidden")
      cardRef.add_css_class("osd-card-visible")
    } else {
      cardRef.remove_css_class("osd-card-visible")
      cardRef.add_css_class("osd-card-hidden")
    }

    if (winRef) {
      winRef.monitor = state.monitor ?? defaultMonitor
      winRef.visible = true
    }
  }

  subscribeOSD(applyState)

  const win = (
    <window
      name="osd"
      namespace="adart-osd"
      class="osd-window"
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      focusable={false}
      visible={true}
      anchor={Astal.WindowAnchor.BOTTOM}
      monitor={defaultMonitor}
      $={(self: Astal.Window) => {
        winRef = self
        if (pendingState) applyState(pendingState)
      }}
    >
      <box class="osd-window-root" halign={Gtk.Align.CENTER} valign={Gtk.Align.END} hexpand vexpand>
        <box
          class="osd-card osd-card-hidden"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.END}
          $={(self: Gtk.Box) => {
            cardRef = self
            if (pendingState) applyState(pendingState)
          }}
        >
          <box class="osd-card-header" spacing={12} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            <image
              class="osd-card-icon"
              pixelSize={48}
              $={(self: Gtk.Image) => {
                iconRef = self
                if (pendingState) applyState(pendingState)
              }}
            />
            <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
              <label
                class="osd-card-label"
                $={(self: Gtk.Label) => {
                  labelRef = self
                  if (pendingState) applyState(pendingState)
                }}
              />
              <label
                class="osd-card-value"
                $={(self: Gtk.Label) => {
                  valueRef = self
                  if (pendingState) applyState(pendingState)
                }}
              />
            </box>
          </box>
          <Gtk.LevelBar
            class="osd-card-progress"
            minValue={0}
            maxValue={100}
            visible={false}
            $={(self: Gtk.LevelBar) => {
              levelRef = self
              if (pendingState) applyState(pendingState)
            }}
          />
        </box>
      </box>
    </window>
  ) as Astal.Window

  return win
}
