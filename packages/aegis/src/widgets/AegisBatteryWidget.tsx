import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { getSysinfoService } from "../services/sysinfo"
import { buildInfoRow } from "./rows"
import { formatPercent, type InfoRow } from "./sections"

function formatHours(hours?: number) {
  if (!Number.isFinite(Number(hours))) return "--"
  const total = Math.max(0, Number(hours))
  const h = Math.floor(total)
  const m = Math.round((total - h) * 60)
  return `${h}h ${m}m`
}

export function AegisBatteryWidget() {
  const service = getSysinfoService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.add_css_class("aegis-battery")

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
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
      list.append(new Gtk.Label({ label: "Loading power...", xalign: 0 }))
      return
    }

    if (!data.power.batteries.length) {
      list.append(new Gtk.Label({ label: "No batteries detected", xalign: 0 }))
      return
    }

    for (const bat of data.power.batteries) {
      const rows: InfoRow[] = [
        {
          label: bat.name,
          value: `${formatPercent(bat.capacityPercent)} • ${bat.status ?? "Unknown"}`,
          minMode: "minimal",
        },
      ]

      if (Number.isFinite(Number(bat.timeRemainingHours))) {
        rows.push({
          label: "Time",
          value: formatHours(bat.timeRemainingHours),
          minMode: "minimal",
        })
      }

      for (const row of rows) list.append(buildInfoRow(row))

      const bar = new Gtk.ProgressBar()
      bar.set_show_text(false)
      bar.add_css_class("aegis-progress")
      const pct = Number.isFinite(Number(bat.capacityPercent)) ? Number(bat.capacityPercent) : 0
      bar.set_fraction(Math.max(0, Math.min(1, pct / 100)))
      list.append(bar)
    }
  }, { immediate: true })

  return root
}
