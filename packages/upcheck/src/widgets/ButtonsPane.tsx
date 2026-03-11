import { Gtk } from "ags/gtk4";
import app from "ags/gtk4/app"
import { refreshUpdates } from "../store";
import { openUpdaterTerminal } from "../services/pacman";

export default function ButtonsPane() {
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
          app.get_window("upcheck")?.hide()
          openUpdaterTerminal()
        }}
      >
        <label label="Update" />
      </button>
    </box>
  )
}

