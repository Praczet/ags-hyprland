import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { getSysinfoService } from "../services/sysinfo"
import { buildInfoRow } from "./rows"
import { formatBytes, type InfoRow } from "./sections"

export function AegisNetworkWidget() {
  const service = getSysinfoService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.add_css_class("aegis-network")

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
      list.append(new Gtk.Label({ label: "Loading network...", xalign: 0 }))
      return
    }

    if (!data.network.interfaces.length) {
      list.append(new Gtk.Label({ label: "No interfaces found", xalign: 0 }))
      return
    }

    for (const iface of data.network.interfaces) {
      const label = iface.state === "up" ? `${iface.name} (up)` : iface.name
      const row: InfoRow = {
        label: `${label}${iface.ssid && iface.ssid !== "" ? ` [${iface.ssid}]` : ""}`,
        value: `${formatBytes(iface.rxBytes)} ↓ / ${formatBytes(iface.txBytes)} ↑`,
        minMode: "minimal",
        icon: iface.icon,
      }
      const boxRow = buildInfoRow(row)
      if (iface.state === "down") {
        boxRow.add_css_class("aegis-network-down")
      }
      list.append(boxRow)
    }
  }, { immediate: true })

  return root
}
