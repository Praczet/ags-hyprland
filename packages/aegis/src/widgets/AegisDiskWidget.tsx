import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { getSysinfoService } from "../services/sysinfo"
import { buildInfoRow } from "./rows"
import { formatBytes, formatPercent, type InfoRow } from "./sections"

export function AegisDiskWidget() {
  const service = getSysinfoService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  root.add_css_class("aegis-disk")

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.append(list)

  const clearBox = () => {
    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }
  }

  createEffect(() => {
    const data = service.data()
    clearBox()
    if (!data) {
      list.append(new Gtk.Label({ label: "Loading disks...", xalign: 0 }))
      return
    }

    if (!data.disks.length) {
      list.append(new Gtk.Label({ label: "No disks found", xalign: 0 }))
      return
    }

    for (const disk of data.disks) {
      const block = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
      block.add_css_class("aegis-disk-block")

      const label = disk.fsType ? `${disk.mount} (${disk.fsType})` : disk.mount
      const row: InfoRow = {
        label,
        value: `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)} (${formatPercent(disk.usedPercent)})`,
        minMode: "minimal",
      }
      block.append(buildInfoRow(row))

      const bar = new Gtk.ProgressBar()
      bar.set_show_text(false)
      bar.add_css_class("aegis-progress")
      const pct = Number.isFinite(Number(disk.usedPercent)) ? Number(disk.usedPercent) : 0
      bar.set_fraction(Math.max(0, Math.min(1, pct / 100)))
      block.append(bar)

      list.append(block)
    }
  }, { immediate: true })

  return root
}
