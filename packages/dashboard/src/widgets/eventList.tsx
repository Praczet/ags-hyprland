import { Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import type { CalendarEvent } from "../services/googleCalendar"

function parseColor(input?: string) {
  const c = new Gdk.RGBA()
  if (input && c.parse(input)) return c
  c.parse("#86d1e9")
  return c
}

function formatDate(start: string) {
  if (!start) return ""
  if (start.length === 10) return start
  return start.replace("T", " ").slice(0, 16)
}

export function buildEventRow(ev: CalendarEvent): Gtk.Widget {
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("dashboard-event-row")

  const today = GLib.DateTime.new_now_local().format("%Y-%m-%d") ?? ""
  const eventDate = ev.start.slice(0, 10)
  if (eventDate === today) row.add_css_class("dashboard-event-today")

  const bar = new Gtk.DrawingArea({ content_width: 4 })
  bar.set_hexpand(false)
  bar.set_vexpand(true)

  const color = parseColor(ev.color)
  bar.set_draw_func((_area, cr, width, height) => {
    cr.setSourceRGBA(color.red, color.green, color.blue, 1)
    cr.rectangle(0, 0, width, height)
    cr.fill()
  })

  const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  text.append(new Gtk.Label({ label: ev.summary || "(no title)", xalign: 0 }))
  text.append(new Gtk.Label({ label: formatDate(ev.start), xalign: 0 }))

  row.append(bar)
  row.append(text)
  return row
}

export function renderEventList(list: Gtk.Box, items: CalendarEvent[], maxItems: number) {
  let child = list.get_first_child()
  while (child) {
    list.remove(child)
    child = list.get_first_child()
  }
  if (!items.length) {
    list.append(new Gtk.Label({ label: "No upcoming events", xalign: 0 }))
    return
  }
  for (const ev of items.slice(0, maxItems)) {
    list.append(buildEventRow(ev))
  }
}
