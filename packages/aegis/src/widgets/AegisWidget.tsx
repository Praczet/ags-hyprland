import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { AegisMode, SysinfoModel } from "../types"
import { getSysinfoService } from "../services/sysinfo"
import { buildSections, type InfoSection, type SectionId } from "./sections"
import { buildInfoRow, copyToClipboard } from "./rows"
import { buildIconImage, resolveHyprlandIcon, resolveOsIcon } from "./icons"
import { AegisDiskWidget } from "./AegisDiskWidget"
import { AegisMemoryWidget } from "./AegisMemoryWidget"
import { AegisNetworkWidget } from "./AegisNetworkWidget"
import { AegisBatteryWidget } from "./AegisBatteryWidget"

export type AegisWidgetConfig = {
  mode?: AegisMode
  sections?: SectionId[]
  showSectionTitles?: boolean
}

function buildSection(section: InfoSection, showTitle: boolean) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  box.add_css_class("aegis-section")

  const rowsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  rowsBox.add_css_class("aegis-section-rows")

  if (showTitle) {
    const title = new Gtk.Label({ label: section.title, xalign: 0 })
    title.add_css_class("aegis-section-title")
    box.append(title)
  }

  for (const row of section.rows) {
    rowsBox.append(buildInfoRow(row))
  }

  box.append(rowsBox)
  return box
}

function buildSectionWithWidget(title: string, showTitle: boolean, widget: Gtk.Widget) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  box.add_css_class("aegis-section")

  if (showTitle) {
    const label = new Gtk.Label({ label: title, xalign: 0 })
    label.add_css_class("aegis-section-title")
    box.append(label)
  }

  const rowsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  rowsBox.add_css_class("aegis-section-rows")
  rowsBox.append(widget)
  box.append(rowsBox)
  return box
}

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    box.remove(child)
    child = box.get_first_child()
  }
}

function buildHero(data: SysinfoModel) {
  const hero = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 48 })
  hero.add_css_class("aegis-hero")
  hero.set_hexpand(true)

  const osBlock = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  osBlock.add_css_class("aegis-hero-block")
  osBlock.set_hexpand(true)
  const osIcon = buildIconImage(resolveOsIcon(data.os), 84)
  if (osIcon) osBlock.append(osIcon)
  const osText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  osText.set_valign(Gtk.Align.CENTER)
  const osName = data.os.prettyName ?? data.os.name ?? data.os.id ?? "Unknown OS"
  const osTitle = new Gtk.Label({ label: osName, xalign: 0 })
  osTitle.add_css_class("aegis-hero-title")
  osTitle.set_wrap(true)
  const osSub = new Gtk.Label({ label: data.kernel.release ?? "", xalign: 0 })
  osSub.add_css_class("aegis-hero-subtitle")
  osSub.set_wrap(true)
  osText.append(osTitle)
  if (data.kernel.release) osText.append(osSub)
  osBlock.append(osText)

  const divider = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL })
  divider.add_css_class("aegis-hero-divider")

  const hyprBlock = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  hyprBlock.add_css_class("aegis-hero-block")
  hyprBlock.set_hexpand(true)
  const hyprIcon = buildIconImage(resolveHyprlandIcon(), 84)
  if (hyprIcon) hyprBlock.append(hyprIcon)
  const hyprText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  hyprText.set_valign(Gtk.Align.CENTER)
  const hyprTitle = new Gtk.Label({ label: "Hyprland", xalign: 0 })
  hyprTitle.add_css_class("aegis-hero-title")
  hyprTitle.set_wrap(true)
  const hyprSub = new Gtk.Label({ label: data.hyprland.version ?? "", xalign: 0 })
  hyprSub.add_css_class("aegis-hero-subtitle")
  hyprSub.set_wrap(true)
  hyprText.append(hyprTitle)
  if (data.hyprland.version) hyprText.append(hyprSub)
  hyprBlock.append(hyprText)

  const sizeGroup = new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL })
  sizeGroup.add_widget(osBlock)
  sizeGroup.add_widget(hyprBlock)

  hero.append(osBlock)
  hero.append(divider)
  hero.append(hyprBlock)
  return hero
}

function renderContent(box: Gtk.Box, data: SysinfoModel | null, err: string | null, mode: AegisMode, sections?: SectionId[], showTitles = true) {
  clearBox(box)
  if (err && !data) {
    const label = new Gtk.Label({ label: err, xalign: 0 })
    label.add_css_class("aegis-error")
    box.append(label)
    return
  }
  if (!data) {
    box.append(new Gtk.Label({ label: "Loading system info...", xalign: 0 }))
    return
  }
  if (mode !== "minimal") {
    box.append(buildHero(data))
  }
  const built = buildSections(data, mode, sections)
  const renderSection = (section: InfoSection) => {
    if (mode === "full") {
      switch (section.id) {
        case "storage":
          return buildSectionWithWidget("Storage", showTitles, AegisDiskWidget())
        case "memory":
          return buildSectionWithWidget("Memory", showTitles, AegisMemoryWidget())
        case "network":
          return buildSectionWithWidget("Network", showTitles, AegisNetworkWidget())
        case "power":
          return buildSectionWithWidget("Power", showTitles, AegisBatteryWidget())
      }
    }
    return buildSection(section, showTitles)
  }

  if (mode === "full") {
    const columns = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 48 })
    columns.add_css_class("aegis-columns")
    columns.set_hexpand(true)
    columns.set_homogeneous(false)

    const left = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
    left.add_css_class("aegis-column")
    left.set_hexpand(true)

    const right = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
    right.add_css_class("aegis-column")
    right.set_hexpand(true)

    const divider = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL })
    divider.add_css_class("aegis-columns-divider")
    divider.set_hexpand(false)
    divider.set_vexpand(true)
    divider.set_size_request(1, -1)

    const sizeGroup = new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL })
    sizeGroup.add_widget(left)
    sizeGroup.add_widget(right)

    const leftIds: SectionId[] = ["system", "hyprland", "status"]
    const rightIds: SectionId[] = ["hardware", "memory", "storage", "network", "power"]

    for (const section of built) {
      const widget = renderSection(section)
      if (leftIds.includes(section.id)) {
        left.append(widget)
      } else if (rightIds.includes(section.id)) {
        right.append(widget)
      } else {
        left.append(widget)
      }
    }

    columns.append(left)
    columns.append(divider)
    columns.append(right)
    box.append(columns)
    return
  }

  for (const section of built) {
    box.append(renderSection(section))
  }
}

export function AegisWidget(cfg: AegisWidgetConfig = {}) {
  const service = getSysinfoService()
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
  list.add_css_class("aegis-root")
  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
  let latestText = ""
  let latestJson = ""

  const footer = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  footer.add_css_class("aegis-footer")
  footer.set_halign(Gtk.Align.CENTER)

  const label = new Gtk.Label({ label: "Copy all info:", xalign: 0.5 })
  label.add_css_class("aegis-footer-label")
  label.add_css_class("aegis-copyable")
  const sep = new Gtk.Label({ label: "|", xalign: 0.5 })
  sep.add_css_class("aegis-footer-sep")
  const textLink = new Gtk.Label({ label: "text", xalign: 0.5 })
  textLink.add_css_class("aegis-footer-link")
  textLink.add_css_class("aegis-copyable")
  const jsonLink = new Gtk.Label({ label: "json", xalign: 0.5 })
  jsonLink.add_css_class("aegis-footer-link")
  jsonLink.add_css_class("aegis-copyable")

  const attachCopy = (widget: Gtk.Widget, getText: () => string) => {
    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      const text = getText()
      if (text) copyToClipboard(text)
    })
    widget.add_controller(click)
  }
  attachCopy(label, () => latestJson)
  attachCopy(textLink, () => latestText)
  attachCopy(jsonLink, () => latestJson)

  footer.append(label)
  footer.append(textLink)
  footer.append(sep)
  footer.append(jsonLink)

  createEffect(() => {
    const data = service.data()
    const err = service.error()
    const mode = cfg.mode ?? service.mode()
    if (data) {
      const built = buildSections(data, mode, cfg.sections)
      const lines: string[] = []
      for (const section of built) {
        lines.push(section.title)
        for (const row of section.rows) {
          lines.push(`  ${row.label}: ${row.value}`)
        }
        lines.push("")
      }
      latestText = lines.join("\n").trim()
      latestJson = JSON.stringify(data, null, 2)
    } else {
      latestText = ""
      latestJson = ""
    }
    renderContent(content, data, err, mode, cfg.sections, cfg.showSectionTitles ?? true)
  }, { immediate: true })

  list.append(content)
  list.append(footer)
  return list
}
