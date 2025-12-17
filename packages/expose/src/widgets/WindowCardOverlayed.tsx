import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"

import { loadExposeConfig } from "../config"
import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"

const cfg = loadExposeConfig()

export function WindowCardOverlayedGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): { widget: Gtk.Button; setThumb: (path: string) => void } {
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

  const overlay = new Gtk.Overlay()
  overlay.set_hexpand(true)
  overlay.set_vexpand(true)
  overlay.set_valign(Gtk.Align.START)
  overlay.add_css_class("expose-thumb")
  overlay.set_child(rev)

  const icon = new Gtk.Image({ pixel_size: cfg.iconSize })
  const gicon = iconForClient(client)
  if (gicon) icon.set_from_gicon(gicon)
  icon.add_css_class("expose-ov-icon")

  const title = new Gtk.Label({
    label: client.title || "(untitled)",
    xalign: 0,
    ellipsize: Pango.EllipsizeMode.END,
    max_width_chars: 32,
  })
  title.add_css_class("expose-ov-title")

  const klass = new Gtk.Label({
    label: client.class || "",
    xalign: 0,
    ellipsize: Pango.EllipsizeMode.END,
    max_width_chars: 32,
  })
  klass.add_css_class("expose-ov-class")

  const textCol = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    hexpand: true,
  })
  textCol.append(title)
  textCol.append(klass)

  const pill = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    hexpand: true,
  })
  pill.add_css_class("expose-ov-pill")
  pill.append(icon)
  pill.append(textCol)

  const vcenter = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, vexpand: true })
  const top = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, vexpand: true })
  const bot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, vexpand: true })
  vcenter.append(top)
  vcenter.append(pill)
  vcenter.append(bot)

  overlay.add_overlay(vcenter)

  const btn = new Gtk.Button()
  btn.set_hexpand(false)
  btn.set_vexpand(false)
  btn.set_size_request(cfg.minTileW, cfg.minTileH)
  btn.set_valign(Gtk.Align.START)
  btn.set_halign(Gtk.Align.START)
  btn.add_css_class("expose-btn")
  btn.set_child(overlay)
  btn.connect("clicked", () => onActivate(client.address))

  return { widget: btn, setThumb }
}
