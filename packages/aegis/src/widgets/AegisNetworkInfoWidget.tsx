import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { getSysinfoService } from "../services/sysinfo"
import { buildInfoRow } from "./rows"
import type { NetworkInterfaceInfo } from "../types"

function formatInterfaceLabel(iface: NetworkInterfaceInfo) {
  const ssid = iface.ssid ?? "--"
  const type = iface.type ?? "--"
  return `${ssid} (${type})`.trim()
}

function formatInterfaceValue(iface: NetworkInterfaceInfo) {
  const state = iface.state ?? "down"
  const primary = iface.primary ? "primary" : "--"
  return `${iface.name} | ${state} | ${primary}`
}

export function AegisNetworkInfoWidget() {
  const service = getSysinfoService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.add_css_class("aegis-network-info")

  const ifaceBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const connector = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL })
  connector.add_css_class("aegis-network-connector")
  const infoBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

  root.append(ifaceBox)
  root.append(connector)
  root.append(infoBox)

  const clearBox = (box: Gtk.Box) => {
    let child = box.get_first_child()
    while (child) {
      box.remove(child)
      child = box.get_first_child()
    }
  }

  createEffect(() => {
    const data = service.data()
    clearBox(ifaceBox)
    clearBox(infoBox)
    connector.set_visible(false)

    if (!data) {
      ifaceBox.append(new Gtk.Label({ label: "Loading network info...", xalign: 0 }))
      return
    }

    if (!data.network.interfaces.length) {
      ifaceBox.append(new Gtk.Label({ label: "No interfaces found", xalign: 0 }))
    } else {
      for (const iface of data.network.interfaces) {
        const row = buildInfoRow({
          label: formatInterfaceLabel(iface),
          value: formatInterfaceValue(iface),
          icon: iface.icon,
          minMode: "summary",
        })
        if (iface.state === "down") row.add_css_class("aegis-network-down")
        ifaceBox.append(row)
      }
    }

    const info = data.network.info ?? {}
    const infoRows = [
      { label: "Host", value: info.hostname ?? "--" },
      { label: "IP", value: info.ip ?? "--" },
      { label: "Gateway", value: info.gateway ?? "--" },
      { label: "SSID", value: info.ssid ?? "--" },
    ]

    for (const row of infoRows) {
      infoBox.append(buildInfoRow({ ...row, minMode: "minimal" }))
    }

    connector.set_visible(true)
  }, { immediate: true })

  return root
}
