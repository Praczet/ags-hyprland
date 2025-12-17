import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import GdkPixbuf from "gi://GdkPixbuf"

import type { ExposeClient } from "../store"
import { iconForClient } from "../icons"
import { loadExposeConfig } from "../config"

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
    console.error("loadScaledPixbuf error", String(e))
    return null
  }
}

export function WindowCardGtk(
  client: ExposeClient,
  onActivate: (address: string) => void,
): { widget: Gtk.Button; setThumb: (path: string) => void } {

  // picture without filename initially; we’ll set it later
  const tileHeight = cfg.minTileH
  const thumbHeight = Math.max(120, tileHeight - 80)
  const thumbWidth = Math.max(160, cfg.minTileW - 40)

  const pic = Gtk.Picture.new()
  pic.set_hexpand(false)
  pic.set_vexpand(false)
  pic.height_request = thumbHeight
  pic.set_can_shrink(true)
  pic.set_valign(Gtk.Align.CENTER)
  pic.set_halign(Gtk.Align.CENTER)
  pic.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  pic.add_css_class("rounded-corners")

  const rev = new Gtk.Revealer()
  rev.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE)
  rev.set_transition_duration(140)
  rev.set_reveal_child(false)
  rev.set_hexpand(true)
  rev.set_vexpand(false)
  rev.add_css_class("rounded-corners")
  rev.height_request = thumbHeight

  rev.set_child(pic)

  const setThumb = (path: string) => {
    const scaled = loadScaledPixbuf(path, thumbWidth, thumbHeight)
    if (scaled) pic.set_pixbuf(scaled)
    else pic.set_filename(path)
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
    vexpand: false,
    valign: Gtk.Align.START,
  })
  thumbBox.height_request = thumbHeight
  thumbBox.set_overflow(Gtk.Overflow.HIDDEN)
  thumbBox.add_css_class("expose-thumb")
  thumbBox.append(rev)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
  })
  card.height_request = tileHeight
  card.set_vexpand(false)
  card.set_valign(Gtk.Align.FILL)
  card.set_overflow(Gtk.Overflow.HIDDEN)
  card.add_css_class("expose-card")
  card.append(thumbBox)
  card.append(metaRow)

  const btn = new Gtk.Button()
  btn.set_size_request(cfg.minTileW, tileHeight)
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
