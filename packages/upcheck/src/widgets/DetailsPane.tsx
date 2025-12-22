import { Gtk } from "ags/gtk4"
import { details, detailsView, err, selected } from "../store"

export default function DetailsPane() {
  return (
    <box class="details" orientation={Gtk.Orientation.VERTICAL} spacing={8}
      hexpand={true} halign={Gtk.Align.FILL}
    >
      <stack
        visible_child_name={detailsView()}
        transition_type={Gtk.StackTransitionType.CROSSFADE}
        // Use the children object to map names to widgets
        $={(self: Gtk.Stack) => {
          self.add_named(
            <box>
              <label class="muted" label="Select a package to see details." />
            </box> as Gtk.Box,
            "empty"
          )
          self.add_named(
            <box>
              <label label="Loading package information…" />
            </box> as Gtk.Box,
            "loading"
          )

          self.add_named(
            <box>
              <label
                class="error"
                wrap
                label={err.as(e => `Error:\n${e ?? ""}`)}
              />
            </box> as Gtk.Box,
            "error"
          )

          self.add_named(
            <box>
              <label class="muted" label="No details yet." />
            </box> as Gtk.Box,
            "nodata"
          )

          self.add_named(
            <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
              <label
                class="title"
                xalign={0}
                label={details.as(d => d?.name ?? "No")}
              />
              <label
                class="muted"
                xalign={0}
                label={selected.as(s =>
                  s ? `${s.oldVer} → ${s.newVer}` : ""
                )}
              />
              <label
                wrap
                xalign={0}
                label={details.as(d => d?.desc ?? "")}
              />
            </box> as Gtk.Box,
            "details"
          )
        }}
      />
    </box>
  )
}
