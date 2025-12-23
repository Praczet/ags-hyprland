import { Gtk } from "ags/gtk4"
import { details, detailsView, err, selected } from "../store"

export default function DetailsPane() {
  return (
    <box class="details" orientation={Gtk.Orientation.VERTICAL} spacing={8}
      hexpand={true} halign={Gtk.Align.FILL}
    >
      <stack
        hexpand={true}
        halign={Gtk.Align.FILL}
        visible_child_name={detailsView.as(c => c)}
        transition_type={Gtk.StackTransitionType.CROSSFADE}
        // Use the children object to map names to widgets
        $={(self: Gtk.Stack) => {
          self.add_named(
            <box
              halign={Gtk.Align.FILL}
              hexpand={true}
            >
              <label
                halign={Gtk.Align.CENTER}
                hexpand={true}
                class="muted" label="Select a package to see details." />
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
            <box
              orientation={Gtk.Orientation.VERTICAL}
              halign={Gtk.Align.FILL}
              hexpand={true}
              spacing={6}>
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                class="package-header"
                halign={Gtk.Align.FILL}
                hexpand={true}
                spacing={6}
              >
                <label
                  class="title"
                  xalign={1}
                  hexpand={true}
                  halign={Gtk.Align.START}
                  label={details.as(d => d?.name ?? "---")}
                />
                <label
                  class="muted"
                  xalign={0}
                  label={selected.as(s =>
                    s ? `${s.oldVer}` : ""
                  )}
                />
                <label
                  class="muted"
                  xalign={0}
                  label="→"
                />
                <label
                  class="new"
                  xalign={0}
                  label={selected.as(s =>
                    s ? s.newVer : ""
                  )}
                />
              </box>
              <label
                wrap
                xalign={0}
                halign={Gtk.Align.CENTER}
                hexpand={true}
                class="description"
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
