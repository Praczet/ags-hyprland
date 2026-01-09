import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango"
import { getNetworkService } from "../services/networkService"
import type { NetworkWidgetConfig } from "../types"
import { createHotspotSection } from "./sections/HotspotSection"
import { createVpnSection } from "./sections/VpnSection"
import { createWiredSection } from "./sections/WiredSection"
import { createWifiSection } from "./sections/WifiSection"
import type { SectionController } from "./sections/sectionUtils"
import { updateHistoryList } from "./sections/sectionUtils"

type SectionInstance = {
  controller: SectionController
  setTooltip: (text: string) => void
}

export function NetworkWidget(cfg: NetworkWidgetConfig = {}) {
  const service = getNetworkService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  root.add_css_class("a-network-root")
  if (cfg.windowLess ?? cfg.windowless) root.add_css_class("a-network-windowless")

  const wifiSection = createWifiSection(cfg, service)
  const wiredSection = createWiredSection(cfg, service)
  const vpnSection = createVpnSection(cfg, service)
  const hotspotSection = createHotspotSection(cfg, service)

  const sectionEntries: Array<{ id: string; section: SectionInstance }> = [
    { id: "wifi", section: wifiSection },
    { id: "wired", section: wiredSection },
    { id: "vpn", section: vpnSection },
    { id: "hotspot", section: hotspotSection },
  ]

  const sectionConfig = new Map<string, { visible?: boolean; order?: number }>()
  if (cfg.sections) {
    for (const entry of cfg.sections) {
      sectionConfig.set(entry.section, { visible: entry.visible, order: entry.order })
    }
  }

  const resolvedSections = sectionEntries
    .map((entry, index) => {
      const pref = sectionConfig.get(entry.id)
      return {
        ...entry,
        visible: pref?.visible !== false,
        order: Number.isFinite(pref?.order) ? Number(pref?.order) : index,
        index,
      }
    })
    .filter(entry => entry.visible)
    .sort((a, b) => a.order - b.order || a.index - b.index)

  const totalSections = resolvedSections.length
  for (const [idx, entry] of resolvedSections.entries()) {
    if (totalSections === 1) {
      entry.section.controller.setPillClass(["a-network-pill-first", "a-network-pill-last"])
    } else if (idx === 0) {
      entry.section.controller.setPillClass("a-network-pill-first")
    } else if (idx === totalSections - 1) {
      entry.section.controller.setPillClass("a-network-pill-last")
    } else {
      entry.section.controller.setPillClass("a-network-pill-middle")
    }
    root.append(entry.section.controller.wrapper)
  }

  const footer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footer.add_css_class("a-network-education")
  const footerLabel = new Gtk.Label({ label: "Education mode", xalign: 0 })
  footerLabel.add_css_class("a-network-education-label")
  footerLabel.wrap = true

  const footerHistory = new Gtk.Revealer({ reveal_child: false })
  const footerHistoryBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footerHistoryBox.add_css_class("a-network-history")
  const footerHistoryScroll = new Gtk.ScrolledWindow()
  footerHistoryScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  footerHistoryScroll.set_propagate_natural_height(true)
  footerHistoryScroll.set_min_content_width(500)
  footerHistoryScroll.set_max_content_height(180)
  footerHistoryScroll.set_child(footerHistoryBox)
  footerHistory.set_child(footerHistoryScroll)
  footer.append(footerLabel)
  footer.append(footerHistory)

  footerLabel.add_controller(
    (() => {
      const click = new Gtk.GestureClick()
      click.connect("released", () => {
        footerHistory.set_reveal_child(!footerHistory.get_reveal_child())
      })
      return click
    })(),
  )

  const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panel.add_css_class("a-network-education-panel")
  const panelTitle = new Gtk.Label({ label: "Education", xalign: 0 })
  panelTitle.add_css_class("a-network-subtitle")
  const panelHistory = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panelHistory.add_css_class("a-network-history")
  panel.append(panelTitle)
  panel.append(panelHistory)

  const lastFooter = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  lastFooter.add_css_class("a-network-footer")
  lastFooter.set_hexpand(true)
  lastFooter.set_halign(Gtk.Align.FILL)
  const lastFooterLabel = new Gtk.Label({ label: "Last: --", xalign: 1, halign: Gtk.Align.CENTER, hexpand: true })
  lastFooterLabel.wrap = true
  lastFooterLabel.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
  lastFooterLabel.add_css_class("a-network-footer-label")
  const lastFooterScroll = new Gtk.ScrolledWindow()
  lastFooterScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  lastFooterScroll.set_propagate_natural_height(true)
  lastFooterScroll.set_min_content_width(500)
  lastFooterScroll.set_max_content_height(48)
  lastFooterScroll.set_child(lastFooterLabel)
  lastFooter.append(lastFooterScroll)

  if (cfg.educationModeOn && cfg.educationModeDetail === "panel") {
    root.append(panel)
  } else if (cfg.educationModeOn && cfg.educationModeDetail === "footer") {
    root.append(footer)
  }
  root.append(lastFooter)

  createEffect(() => {
    const history = service.history()
    if (!cfg.educationModeOn) return
    const latest = history[0]
    const tooltip = latest ? `${latest.action}\n${latest.command ?? ""}`.trim() : "No recent actions"
    wifiSection.setTooltip(tooltip)
    wiredSection.setTooltip(tooltip)
    vpnSection.setTooltip(tooltip)
    hotspotSection.setTooltip(tooltip)

    if (cfg.educationModeDetail === "footer") {
      footerLabel.set_label(latest ? `Education: ${latest.action}` : "Education: idle")
      updateHistoryList(footerHistoryBox, history)
    }
    if (cfg.educationModeDetail === "panel") {
      updateHistoryList(panelHistory, history)
    }
  }, { immediate: true })

  createEffect(() => {
    const history = service.history()
    const latest = history[0]
    const cmd = latest?.command ? ` > ${latest.command}` : ""
    lastFooterLabel.set_label(latest ? `Last: ${latest.action}${cmd}` : "Last: --")
  }, { immediate: true })

  const refreshConfig = {
    allowBackgroundRefresh: cfg.allowBackgroundRefresh ?? false,
    refreshOnShow: cfg.refreshOnShow ?? true,
    refreshMs: cfg.refreshMs,
  }
  service.setActive("a-network-widget", false, refreshConfig)
  root.connect("map", () => {
    service.setActive("a-network-widget", true, refreshConfig)
  })
  root.connect("unmap", () => {
    service.setActive("a-network-widget", false, refreshConfig)
  })

  return root
}
