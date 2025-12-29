import { Gtk } from "ags/gtk4"

export function WidgetFrame(title: string | undefined, body: Gtk.Widget) {
  return (
    <box class="dashboard-widget-inner" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      {title ? (
        <box halign={Gtk.Align.CENTER} class="dashboard-widget-title-pill">
          <label class="dashboard-widget-title" label={title} halign={Gtk.Align.CENTER} />
        </box>
      ) : null}
      {body}
    </box>
  ) as Gtk.Box
}
