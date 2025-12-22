import { Gtk } from "ags/gtk4";

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
      >
        <label label="Refresh" />
      </button>
      <button class="btn-update" focusable={true}
        hexpand={true} halign={Gtk.Align.END}
      >
        <label label="Update" />
      </button>
    </box>
  )
}

