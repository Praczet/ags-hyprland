import { Gtk } from "ags/gtk4"
import type { NetworkAction } from "../../types"

export type SectionController = {
  wrapper: Gtk.Box
  setExpanded: (expanded: boolean) => void
  getExpanded: () => boolean
  setPillClass: (pillClass?: string | string[]) => void
}

export function createInfoIcon() {
  const label = new Gtk.Label({ label: "?" })
  label.add_css_class("a-network-info-icon")
  return label
}

export function buildSection(
  title: string,
  headerRight: Gtk.Widget | null,
  body: Gtk.Widget,
  expanded = true,
  infoIcon?: Gtk.Widget,
  collapsible = true,
  pillClass?: string,
  collapsedInfo?: Gtk.Widget,
): SectionController {
  const wrapper = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  wrapper.add_css_class("a-network-section")
  wrapper.set_hexpand(true)

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  header.add_css_class("a-network-section-header")
  header.add_css_class("a-network-section-pill")
  header.height_request = 56
  if (pillClass) header.add_css_class(pillClass)

  header.set_hexpand(true)

  const label = new Gtk.Label({ label: title, xalign: 0 })
  label.add_css_class("a-network-section-title")
  label.set_hexpand(true)

  const chevron = new Gtk.Label({ label: expanded ? "▾" : "▸", xalign: 1 })
  chevron.add_css_class("a-network-chevron")

  header.append(label)
  if (collapsedInfo) header.append(collapsedInfo)
  if (infoIcon) header.append(infoIcon)
  if (headerRight) header.append(headerRight)
  header.append(chevron)

  const reveal = new Gtk.Revealer({ reveal_child: expanded })
  reveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  reveal.set_child(body)

  let isExpanded = expanded
  const knownPillClasses = ["a-network-pill-first", "a-network-pill-middle", "a-network-pill-last"]
  const setPillClass = (next?: string | string[]) => {
    for (const cls of knownPillClasses) header.remove_css_class(cls)
    const list = Array.isArray(next) ? next : next ? [next] : []
    for (const cls of list) header.add_css_class(cls)
    if (list.includes("a-network-pill-last")) {
      wrapper.add_css_class("a-network-section-last")
    } else {
      wrapper.remove_css_class("a-network-section-last")
    }
  }

  const applyExpanded = (next: boolean) => {
    isExpanded = next
    reveal.set_reveal_child(next)
    chevron.set_label(next ? "▾" : "▸")
    if (next) {
      header.remove_css_class("a-network-section-collapsed")
      header.add_css_class("a-network-section-expanded")
    } else {
      header.remove_css_class("a-network-section-expanded")
      header.add_css_class("a-network-section-collapsed")
    }
    if (collapsedInfo) collapsedInfo.set_visible(!next)
  }

  applyExpanded(expanded)
  setPillClass(pillClass)

  if (collapsible) {
    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      applyExpanded(!isExpanded)
    })
    header.add_controller(click)
  }

  wrapper.append(header)
  wrapper.append(reveal)
  return {
    wrapper,
    setExpanded: applyExpanded,
    getExpanded: () => isExpanded,
    setPillClass,
  }
}

export function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    box.remove(child)
    child = box.get_first_child()
  }
}

export function updateHistoryList(box: Gtk.Box, history: NetworkAction[]) {
  clearBox(box)
  if (!history.length) {
    box.append(new Gtk.Label({ label: "No recent actions", xalign: 0 }))
    return
  }
  for (const entry of history) {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
    row.add_css_class("a-network-history-row")
    const label = new Gtk.Label({ label: entry.action, xalign: 0 })
    label.add_css_class("a-network-history-label")
    const meta = new Gtk.Label({
      label: entry.command ? entry.command : new Date(entry.ts).toLocaleTimeString(),
      xalign: 0,
    })
    meta.add_css_class("a-network-history-meta")
    row.append(label)
    row.append(meta)
    box.append(row)
  }
}
