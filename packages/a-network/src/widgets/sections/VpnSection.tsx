import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { NetworkWidgetConfig } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { buildSection, clearBox, createInfoIcon } from "./sectionUtils"

export function createVpnSection(cfg: NetworkWidgetConfig, service: NetworkService) {
  const vpnBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  vpnBody.add_css_class("a-network-section-body")
  const vpnList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const vpnScroll = new Gtk.ScrolledWindow()
  vpnScroll.add_css_class("a-network-list-scroll")
  vpnScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  vpnScroll.set_propagate_natural_height(true)
  vpnScroll.set_hexpand(true)
  vpnScroll.set_max_content_height(240)
  vpnScroll.set_child(vpnList)
  vpnBody.append(vpnScroll)
  const vpnInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const vpnSection = buildSection("VPN", null, vpnBody, false, vpnInfoIcon, true)

  createEffect(() => {
    const data = service.data()
    clearBox(vpnList)
    if (!data) {
      vpnList.append(new Gtk.Label({ label: "Loading...", xalign: 0 }))
      return
    }
    if (!data.vpn.length) {
      vpnList.append(new Gtk.Label({ label: "No active VPN", xalign: 0 }))
    } else {
      for (const vpn of data.vpn) {
        const row = new Gtk.Label({ label: vpn.name, xalign: 0 })
        row.add_css_class("a-network-row")
        vpnList.append(row)
      }
    }
  }, { immediate: true })

  return {
    controller: vpnSection,
    setTooltip: (text: string) => {
      if (vpnInfoIcon) vpnInfoIcon.set_tooltip_text(text)
    },
  }
}
