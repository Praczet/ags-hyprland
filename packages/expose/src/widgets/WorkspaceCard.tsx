import Gtk from "gi://Gtk?version=4.0"
import type { ExposeClient } from "../store"
import { WindowMiniTileGtk } from "./WindowMiniTile"

export function WorkspaceCardGtk(
  workspaceId: number,
  windows: ExposeClient[],
  opts: { isActive: boolean; iconSize: number },
  onActivate: (addr: string) => void,
): Gtk.Widget {
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
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
    label: `Workspace ${workspaceId}`,
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

  const MAX = 12
  for (const c of windows.slice(0, MAX)) {
    tiles.append(
      WindowMiniTileGtk(
        c,
        { showIcon: opts.isActive, iconSize: opts.iconSize },
        onActivate,
      ),
    )
  }

  root.append(header)
  root.append(tiles)

  return root
}
