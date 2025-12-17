import Gtk from "gi://Gtk?version=4.0"
import type { ExposeClient } from "../store"
import { WindowMiniTileGtk } from "./WindowMiniTile"

import { loadExposeConfig } from "../config"
const cfg = loadExposeConfig()

export function WorkspaceCardGtk(
  workspaceId: number,
  windows: ExposeClient[],
  opts: { isActive: boolean; iconSize: number },
  onActivate: (addr: string) => void,
): { widget: Gtk.Widget; focusables: Gtk.Button[] } {
  const focusables: Gtk.Button[] = []
  let focusCount = 0

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  root.set_hexpand(true)
  root.set_vexpand(true)
  root.set_valign(Gtk.Align.FILL)
  root.set_halign(Gtk.Align.FILL)
  root.set_size_request(cfg.minTileW, -1)
  root.add_css_class("ws-card")
  if (opts.isActive) root.add_css_class("ws-card-active")

  const header = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    hexpand: true,
    halign: Gtk.Align.FILL,
    spacing: 20
  })
  header.add_css_class("ws-header")

  const title = new Gtk.Label({
    label: workspaceId != -98 ? `Workspace: ${workspaceId}` : "🪄 Magic Workspace",
    hexpand: true,
    halign: Gtk.Align.START
  })
  title.add_css_class("ws-title")

  const count = new Gtk.Label({ label: `(${windows.length})`, halign: Gtk.Align.END })
  count.add_css_class("ws-count")

  if (opts.isActive) {
    const icon = new Gtk.Image({ icon_name: "radio-checked-symbolic", pixel_size: 24 })
    header.append(icon)
  }

  header.append(title)
  header.append(count)

  const tiles = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    homogeneous: true,
    row_spacing: 10,
    column_spacing: 10,
    min_children_per_line: 2,
    max_children_per_line: 4,
  })
  tiles.add_css_class("ws-tiles")
  tiles.set_valign(Gtk.Align.START)

  const attachFocusTracking = (widget: Gtk.Widget) => {
    const focusCtrl = new Gtk.EventControllerFocus()
    focusCtrl.connect("enter", () => {
      focusCount += 1
      root.add_css_class("ws-card-focused")
    })
    focusCtrl.connect("leave", () => {
      focusCount = Math.max(0, focusCount - 1)
      if (focusCount === 0) root.remove_css_class("ws-card-focused")
    })
    widget.add_controller(focusCtrl)
  }

  const MAX = 12
  for (const c of windows.slice(0, MAX)) {
    const b = WindowMiniTileGtk(
      c,
      { showIcon: opts.isActive, iconSize: opts.iconSize },
      onActivate,
    )
    attachFocusTracking(b)
    focusables.push(b)
    tiles.append(b)
  }

  root.append(header)
  const sc = new Gtk.ScrolledWindow()
  sc.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  sc.set_propagate_natural_height(true)
  sc.set_vexpand(false)
  sc.set_hexpand(true)
  sc.set_valign(Gtk.Align.FILL)
  sc.set_halign(Gtk.Align.FILL)
  sc.set_child(tiles)

  root.append(sc)

  return { widget: root, focusables }
}
