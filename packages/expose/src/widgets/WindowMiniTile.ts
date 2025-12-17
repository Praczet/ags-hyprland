import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"

export function WindowMiniTileGtk(
  client: ExposeClient,
  opts: { showIcon: boolean; iconSize: number },
  onActivate: (addr: string) => void,
): Gtk.Widget {
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })

  const icon = new Gtk.Image({ pixel_size: opts.iconSize })
  const gicon = iconForClient(client)
  if (gicon) icon.set_from_gicon(gicon)
  icon.add_css_class("ws-tile-icon")
  row.append(icon)
  if (opts.showIcon) {
  }

  const label = new Gtk.Label({
    label: client.title || client.class || "(untitled)",
    xalign: 0,
    ellipsize: Pango.EllipsizeMode.END,
    max_width_chars: 20,
  })
  label.add_css_class("ws-tile-label")
  row.append(label)

  const btn = new Gtk.Button()
  btn.add_css_class("ws-tile")
  btn.set_child(row)
  btn.connect("clicked", () => onActivate(client.address))

  return btn
}
