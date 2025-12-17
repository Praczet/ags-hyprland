import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"

import { loadExposeConfig } from "../config"
const cfg = loadExposeConfig()


export function WindowCardGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): Gtk.Widget {

  const pic = Gtk.Picture.new_for_filename(client.thumb ?? "")
  pic.set_hexpand(true)
  pic.set_vexpand(true)
  pic.set_content_fit(Gtk.ContentFit.COVER) // or CONTAIN

  const title = new Gtk.Label({
    label: client.title || "(untitled)",
    xalign: 0,
    ellipsize: Pango.EllipsizeMode.END,
  })

  const klass = new Gtk.Label({
    label: client.class || "",
    xalign: 0,
    ellipsize: Pango.EllipsizeMode.END,
  })

  const metaRow = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
  });

  metaRow.add_css_class("expose-meta-row");

  const icon = new Gtk.Image({ pixel_size: cfg.iconSize })
  const gicon = iconForClient(client)
  if (gicon) icon.set_from_gicon(gicon)
  icon.add_css_class("expose-icon")
  metaRow.append(icon);

  const meta = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
  })

  meta.add_css_class("expose-meta")
  meta.append(title)
  meta.append(klass)

  metaRow.append(meta);

  const thumbBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
    vexpand: true,
  })

  thumbBox.add_css_class("expose-thumb")
  thumbBox.append(pic)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
  })

  card.add_css_class("expose-card")
  card.append(thumbBox)
  card.append(metaRow)


  const btn = new Gtk.Button()
  btn.add_css_class("expose-btn")
  btn.set_child(card)

  btn.connect("clicked", () => onActivate(client.address))

  return btn
}
