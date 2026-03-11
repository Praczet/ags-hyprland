import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import GdkPixbuf from "gi://GdkPixbuf"

import { loadExposeConfig } from "../config"
import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"

const cfg = loadExposeConfig()

function loadScaledPixbuf(path: string, targetW: number, cropH: number): GdkPixbuf.Pixbuf | null {
  try {
    const original = GdkPixbuf.Pixbuf.new_from_file(path)
    const ow = original.get_width()
    const oh = original.get_height()
    if (!ow || !oh) return original

    const scale = ow > targetW ? targetW / ow : 1
    const width = Math.max(1, Math.floor(ow * scale))
    const height = Math.max(1, Math.floor(oh * scale))
    const scaled = scale < 1
      ? original.scale_simple(width, height, GdkPixbuf.InterpType.BILINEAR)
      : original

    if (height <= cropH) return scaled

    return scaled?.new_subpixbuf(0, 0, width, cropH) ?? null
  } catch (e) {
    console.error("loadScaledPixbuf overlay error", String(e))
    return null
  }
}

export function WindowCardOverlayedGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): { widget: Gtk.Button; setThumb: (path: string) => void } {
  const tileHeight = cfg.minTileH
  const thumbWidth = Math.max(160, cfg.minTileW)
  const pic = Gtk.Picture.new()
  pic.set_hexpand(false)
  pic.set_vexpand(false)
  pic.height_request = tileHeight
  pic.set_can_shrink(true)
  pic.set_valign(Gtk.Align.CENTER)
  pic.set_halign(Gtk.Align.CENTER)
  pic.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  pic.add_css_class("rounded-corners")

  const rev = new Gtk.Revealer()
  rev.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE)
  rev.set_transition_duration(1400)
  rev.set_reveal_child(false)
  rev.set_hexpand(true)
  rev.set_vexpand(false)
  rev.height_request = tileHeight
  rev.add_css_class("rounded-corners")
  rev.set_child(pic)

  const setThumb = (path: string) => {
    const scaled = loadScaledPixbuf(path, thumbWidth, tileHeight)
    if (scaled) pic.set_pixbuf(scaled)
    else pic.set_filename(path)
    rev.set_reveal_child(true)
  }

  const overlay = new Gtk.Overlay()
  overlay.set_hexpand(true)
  overlay.set_vexpand(false)
  overlay.height_request = tileHeight
  overlay.set_valign(Gtk.Align.START)
  overlay.set_overflow(Gtk.Overflow.HIDDEN)
  overlay.add_css_class("expose-thumb")
  overlay.add_css_class("rounded-corners")
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
