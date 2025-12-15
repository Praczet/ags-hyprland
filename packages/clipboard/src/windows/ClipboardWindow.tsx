import app from "ags/gtk4/app"
import { Accessor } from "ags"
import css from "./styles.css"
import matugen from "./matugen.css"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import MyClipPicker from "./MyClipPicker"
import { filteredItems, refreshClipboard } from "./store"

function ClipManager(monitor = 0) {
  // rgb(255, 255, 1);
  const win = (
    <window
      namespace="adart-clipboard"
      name="adart-clipboard"
      visible
      class="myclip-manager-window"
      anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      keymode={Astal.Keymode.ON_DEMAND}
      monitor={monitor}
      onShow={() => {
        // Refresh clipboard items when the window is shown
        refreshClipboard()
      }}
    >
      <MyClipPicker clipboardItems={filteredItems} />
    </window>
  ) as unknown as Gtk.Window
  // --- ADD KEY CONTROLLER AFTER CREATION ---
  const key = new Gtk.EventControllerKey();
  key.connect("key-pressed", (_, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      // app.quit();
      win.hide();
      return true;
    }
    return false;
  });
  win.add_controller(key);

  const focus = new Gtk.EventControllerFocus()
  focus.connect("leave", () => {
    if (win.visible) {
      win.hide()
    }
  })
  win.add_controller(focus)


  app.add_window(win)
  return win
}

app.start({
  main() {
    refreshClipboard()
    ClipManager(0)
  },
  instanceName: "adart-clipboard",
  css: css + matugen,
})
