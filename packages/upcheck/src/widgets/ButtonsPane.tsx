import { Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { openUpdaterTerminal } from "../services/pacman"
import { refreshUpdates } from "../store"
import { UPCHECK_WINDOW_NAME, type UpcheckWindowHandle } from "../windows/Upcheck"

export function ButtonsPane() {
  return (
    <box
      class="buttons-pane"
      orientation={Gtk.Orientation.HORIZONTAL}
      hexpand={true}
      halign={Gtk.Align.FILL}
    >
      <button class="btn-check" focusable={true}
        hexpand={true} halign={Gtk.Align.START}
        onActivate={refreshUpdates}
        onClicked={refreshUpdates}
      >
        <label label="Refresh" />
      </button>
      <button class="btn-update" focusable={true}
        hexpand={true} halign={Gtk.Align.END}
        onClicked={() => {
          const window = app.get_window(UPCHECK_WINDOW_NAME) as UpcheckWindowHandle | null
          window?.closeWindow()
          openUpdaterTerminal()
        }}
      >
        <label label="Update" />
      </button>
    </box>
  )
}
