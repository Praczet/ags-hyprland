import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"

import { loadExposeConfig } from "../config"
const cfg = loadExposeConfig()

import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"

export function WindowCardOverlayedGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): Gtk.Widget {
  // --- thumbnail as background ---
  const pic = Gtk.Picture.new_for_filename(client.thumb ?? "")
  pic.set_hexpand(true)
  pic.set_vexpand(true)
  pic.set_content_fit(Gtk.ContentFit.COVER)

  // --- overlay container (stacked) ---
  const overlay = new Gtk.Overlay()
  overlay.add_css_class("expose-ov-thumb")
  overlay.set_child(pic)

  // --- icon ---
  const icon = new Gtk.Image({ pixel_size: cfg.iconSize })
  const gicon = iconForClient(client)
  if (gicon) icon.set_from_gicon(gicon)
  icon.add_css_class("expose-ov-icon")

  // --- title + class (two lines) ---
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

  // --- pill that stretches horizontally (X) ---
  const pill = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    hexpand: true,
  })
  pill.add_css_class("expose-ov-pill")
  pill.append(icon)
  pill.append(textCol)

  // --- center vertically: top filler + pill + bottom filler ---
  // This keeps the pill centered in Y while it still fills X.
  const vcenter = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    vexpand: true,
  })
  const top = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, vexpand: true })
  const bot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, vexpand: true })
  vcenter.append(top)
  vcenter.append(pill)
  vcenter.append(bot)

  // Put the centered overlay on top of the picture
  overlay.add_overlay(vcenter)

  // --- click wrapper ---
  const btn = new Gtk.Button()
  btn.add_css_class("expose-btn")
  btn.set_child(overlay)
  btn.connect("clicked", () => onActivate(client.address))

  return btn
}
