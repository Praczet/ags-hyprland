import { Astal, Gdk, Gtk } from "ags/gtk4"
import { ClipPicker } from "../widgets/ClipPicker"
import { filteredItems, refreshClipboard } from "../store"

export const CLIPBOARD_WINDOW_NAME = "clipboard"

export type ClipboardWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
}

export function ClipboardWindow(monitor = 0) {
  const win = (
    <window
      name={CLIPBOARD_WINDOW_NAME}
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
  ) as ClipboardWindowHandle

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

  // focus-leave hides
  const focus = new Gtk.EventControllerFocus()
  focus.connect("leave", () => {
    if (win.visible) win.closeWindow()
  })
  win.add_controller(focus)

  win.openWindow = () => {
    if (typeof win.present === "function") {
      win.present()
    } else {
      win.visible = true
    }
  }
  win.closeWindow = () => {
    win.visible = false
  }

  return win
}
