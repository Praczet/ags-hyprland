import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import type { ExternalAppButton, NetworkWidgetConfig } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { updateNetworkConfig } from "../../config"
import { buildSection } from "./sectionUtils"

function sortButtons(buttons: ExternalAppButton[]) {
  return buttons
    .map((button, index) => ({ button, index }))
    .sort((a, b) => {
      const aOrder = a.button.order ?? a.index
      const bOrder = b.button.order ?? b.index
      return aOrder - bOrder
    })
    .map(entry => entry.button)
}

function buildToggleRow(labelText: string, initial: boolean, onToggle: (next: boolean) => void) {
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("network-row")
  const label = new Gtk.Label({ label: labelText, xalign: 0 })
  label.set_hexpand(true)
  const toggle = new Gtk.Switch()
  toggle.add_css_class("network-switch")
  toggle.set_halign(Gtk.Align.END)
  toggle.set_valign(Gtk.Align.CENTER)
  toggle.set_active(initial)
  toggle.connect("notify::active", () => onToggle(toggle.get_active()))
  row.append(label)
  row.append(toggle)
  return row
}

function buildAppButton(button: ExternalAppButton) {
  const btn = new Gtk.Button()
  btn.add_css_class("network-row")
  btn.set_hexpand(true)
  btn.set_halign(Gtk.Align.FILL)

  const content = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  const icon = new Gtk.Image({ pixel_size: 16 })
  icon.set_from_icon_name(button.icon || "application-x-executable-symbolic")
  const label = new Gtk.Label({ label: button.label || button.command || "Open", xalign: 0 })
  label.set_hexpand(true)
  content.append(icon)
  content.append(label)
  btn.set_child(content)

  btn.connect("clicked", () => {
    if (!button.command) return
    try {
      GLib.spawn_command_line_async(button.command)
    } catch (err) {
      console.error("network utilities command error", err)
    }
  })

  return btn
}

export function createUtilitiesSection(cfg: NetworkWidgetConfig, _service: NetworkService) {
  const body = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  body.add_css_class("network-section-body")

  const eduToggle = buildToggleRow("Education mode", Boolean(cfg.educationModeOn), (next) => {
    updateNetworkConfig({ educationModeOn: next })
  })
  body.append(eduToggle)

  const windowlessToggle = buildToggleRow("Windowless", Boolean(cfg.windowLess ?? cfg.windowless), (next) => {
    const updates: Record<string, unknown> = {}
    if (cfg.windowless !== undefined) {
      updates.windowless = next
    } else if (cfg.windowLess !== undefined) {
      updates.windowLess = next
    } else {
      updates.windowless = next
    }
    updateNetworkConfig(updates)
  })
  body.append(windowlessToggle)

  const buttons = cfg.buttons?.length ? sortButtons(cfg.buttons) : []
  if (buttons.length) {
    for (const button of buttons) {
      body.append(buildAppButton(button))
    }
  }

  const headerIcon = new Gtk.Image({ pixel_size: 16 })
  headerIcon.set_from_icon_name("applications-utilities-symbolic")
  const section = buildSection("Utilities", headerIcon, body, false, undefined, true)

  return {
    controller: section,
    setTooltip: (_text: string) => {},
  }
}
