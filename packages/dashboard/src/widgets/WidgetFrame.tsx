import { Gtk } from "ags/gtk4"

export function WidgetFrame(title: string | undefined, body: Gtk.Widget) {
  return (
    <box class="dashboard-widget-inner" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      {title ? (
        <box class="dashboard-widget-title-wrap" hexpand={true}>
          <label class="dashboard-widget-title" label={title} halign={Gtk.Align.CENTER} hexpand={true} />
        </box>
      ) : null}
      {body}
    </box>
  ) as Gtk.Box
}
