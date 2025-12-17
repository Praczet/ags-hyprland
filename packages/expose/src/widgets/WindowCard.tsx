import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"

import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"
import { loadExposeConfig } from "../config"

const cfg = loadExposeConfig()

export function WindowCardGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): { widget: Gtk.Button; setThumb: (path: string) => void } {

  // picture without filename initially; we’ll set it later
  const pic = Gtk.Picture.new()
  pic.set_hexpand(true)
  pic.set_vexpand(true)
  pic.set_content_fit(Gtk.ContentFit.COVER)

  const rev = new Gtk.Revealer()
  rev.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE)
  rev.set_transition_duration(140)
  rev.set_reveal_child(false)
  rev.set_hexpand(true)
  rev.set_vexpand(true)
  rev.set_child(pic)

  const setThumb = (path: string) => {
    pic.set_filename(path)
    rev.set_reveal_child(true)
  }

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

  const metaRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
  metaRow.add_css_class("expose-meta-row")

  const icon = new Gtk.Image({ pixel_size: cfg.iconSize })
  const gicon = iconForClient(client)
  if (gicon) icon.set_from_gicon(gicon)
  icon.add_css_class("expose-icon")
  metaRow.append(icon)

  const meta = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    hexpand: true,
  })
  meta.add_css_class("expose-meta")
  meta.append(title)
  meta.append(klass)

  metaRow.append(meta)

  const thumbBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
    vexpand: true,

  })

  thumbBox.add_css_class("expose-thumb")
  thumbBox.append(rev)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
  })
  card.add_css_class("expose-card")
  card.append(thumbBox)
  card.append(metaRow)

  const btn = new Gtk.Button()
  btn.set_size_request(cfg.minTileW, cfg.minTileH)
  btn.set_hexpand(false)
  btn.set_vexpand(false)
  btn.set_valign(Gtk.Align.START)
  btn.add_css_class("expose-btn")
  btn.set_child(card)
  btn.connect("clicked", () => onActivate(client.address))

  // if you still have a pre-cached thumb on the client, set it now
  if (client.thumb) setThumb(client.thumb)

  return { widget: btn, setThumb }
}
