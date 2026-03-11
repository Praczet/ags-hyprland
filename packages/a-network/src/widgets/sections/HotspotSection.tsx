import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { NetworkWidgetConfig } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { buildSection, createInfoIcon } from "./sectionUtils"

export function createHotspotSection(cfg: NetworkWidgetConfig, service: NetworkService) {
  const hotspotBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  hotspotBody.add_css_class("a-network-section-body")
  const hotspotStatus = new Gtk.Label({ label: "Hotspot disabled", xalign: 0 })
  hotspotBody.append(hotspotStatus)
  const hotspotInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const hotspotSection = buildSection("Hotspot", null, hotspotBody, false, hotspotInfoIcon, true)

  createEffect(() => {
    const data = service.data()
    if (!data) {
      hotspotStatus.set_label("Loading...")
      return
    }
    if (data.hotspot?.active) {
      hotspotStatus.set_label(`Hotspot active: ${data.hotspot.name ?? "unknown"}`)
    } else {
      hotspotStatus.set_label("Hotspot disabled")
    }
  }, { immediate: true })

  return {
    controller: hotspotSection,
    setTooltip: (text: string) => {
      if (hotspotInfoIcon) hotspotInfoIcon.set_tooltip_text(text)
    },
  }
}
