import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import { refreshUpdates } from "../store"
import { MainView } from "../widgets/MainView"

export const UPCHECK_WINDOW_NAME = "upcheck"

export type UpcheckWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
}

export function Upcheck(defaultMonitor = 0) {
  const monitor = defaultMonitor
  const win = (
    <window
      name={UPCHECK_WINDOW_NAME}
      namespace="adart-upcheck"
      class="upcheck-window"
      visible={false}
      monitor={monitor}
      margin_bottom={20}
      widthRequest={1400}
      margin_top={20}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM}

      $={(_self: Astal.Window) => {
        refreshUpdates()

        _self.connect("notify::visible", () => {
          if (_self.visible) {
            refreshUpdates()
          }
        })
      }}
    >
      <MainView />
    </window>
  ) as UpcheckWindowHandle

  win.openWindow = () => {
    win.show()
  }

  win.closeWindow = () => {
    win.hide()
  }

  // ESC hides
  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.closeWindow()
      return true
    }
    return false
  })
  win.add_controller(key)

  // --- CLICK OUTSIDE CONTROLLER ---
  const click = new Gtk.GestureClick()
  click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  click.connect("pressed", (gesture, _nPress, x, y) => {
    const child = win.get_child()
    if (child) {
      const alloc = child.get_allocation()

      const isInside = (
        x >= alloc.x &&
        x <= alloc.x + alloc.width &&
        y >= alloc.y &&
        y <= alloc.y + alloc.height
      )

      if (!isInside) {
        win.closeWindow()
        gesture.set_state(Gtk.EventSequenceState.CLAIMED)
      }
    }
  })
  win.add_controller(click)

  return win
}
