import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { getSysinfoService } from "../services/sysinfo"
import { buildInfoRow } from "./rows"
import { formatBytes, formatPercent, type InfoRow } from "./sections"

export function AegisMemoryWidget() {
  const service = getSysinfoService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  root.add_css_class("aegis-memory")

  const bar = new Gtk.ProgressBar()
  bar.set_show_text(false)
  bar.add_css_class("aegis-progress")

  const rowsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

  root.append(bar)
  root.append(rowsBox)

  const clearBox = () => {
    let child = rowsBox.get_first_child()
    while (child) {
      rowsBox.remove(child)
      child = rowsBox.get_first_child()
    }
  }

  createEffect(() => {
    const data = service.data()
    clearBox()
    if (!data) {
      rowsBox.append(new Gtk.Label({ label: "Loading memory...", xalign: 0 }))
      bar.set_fraction(0)
      return
    }

    const mem = data.memory
    const pct = Number.isFinite(Number(mem.usedPercent)) ? Number(mem.usedPercent) : 0
    bar.set_fraction(Math.max(0, Math.min(1, pct / 100)))

    const rows: InfoRow[] = [
      {
        label: "Usage",
        value: `${formatBytes(mem.usedBytes)} / ${formatBytes(mem.totalBytes)} (${formatPercent(mem.usedPercent)})`,
        minMode: "minimal",
      },
      {
        label: "Available",
        value: formatBytes(mem.availableBytes),
        minMode: "minimal",
      },
    ]

    if (Number.isFinite(Number(mem.swapTotalBytes)) && Number(mem.swapTotalBytes) > 0) {
      rows.push({
        label: "Swap",
        value: `${formatBytes(mem.swapUsedBytes)} / ${formatBytes(mem.swapTotalBytes)} (${formatPercent(mem.swapUsedPercent)})`,
        minMode: "minimal",
      })
    }

    for (const row of rows) rowsBox.append(buildInfoRow(row))
  }, { immediate: true })

  return root
}
