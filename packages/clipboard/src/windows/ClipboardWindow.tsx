import { Astal, Gdk, Gtk } from "ags/gtk4"
import ClipPicker from "../widgets/ClipPicker"
import { filteredItems, refreshClipboard } from "../store"

export function ClipboardWindow(monitor = 0) {
  const win = (
    <window
      name="clipboard"
      namespace="adart-clipboard"
      visible={false}
      class="clipboard-window"
      anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      keymode={Astal.Keymode.ON_DEMAND}
      monitor={monitor}
      onShow={() => refreshClipboard()}
    >
      <ClipPicker clipboardItems={filteredItems} />
    </window>
  ) as unknown as Gtk.Window

  // ESC hides
  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.hide()
      return true
    }
    return false
  })
  win.add_controller(key)

  // focus-leave hides
  const focus = new Gtk.EventControllerFocus()
  focus.connect("leave", () => {
    if (win.visible) win.hide()
  })
  win.add_controller(focus)

  return win
}
