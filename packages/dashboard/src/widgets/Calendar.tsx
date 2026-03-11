import { type Accessor, createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import type { CalendarEvent } from "../services/googleCalendar"
import { WidgetFrame } from "./WidgetFrame"
import { renderEventList } from "./eventList"

export type CalendarConfig = {
  title?: string
  showTitle?: boolean
  markedDates?: string[] | Accessor<string[]>
  useGoogle?: boolean
  events?: Accessor<CalendarEvent[]>
  showEvents?: boolean
  noEvents?: number
}

type Mark = {
  year: number
  month: number
  day: number
}

function parseMarks(dates: string[] = []): Mark[] {
  const out: Mark[] = []
  for (const d of dates) {
    if (typeof d !== "string") continue
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      out.push({
        year: Number(m[1]),
        month: Number(m[2]) - 1,
        day: Number(m[3]),
      })
      continue
    }
    const dt = GLib.DateTime.new_from_iso8601(d, null)
    if (!dt) continue
    out.push({
      year: dt.get_year(),
      month: dt.get_month() - 1,
      day: dt.get_day_of_month(),
    })
  }
  return out
}

export function CalendarWidget(cfg: CalendarConfig = {}) {
  const calendar = new Gtk.Calendar()
  calendar.add_css_class("dashboard-calendar")

  let marks = parseMarks(typeof cfg.markedDates === "function" ? cfg.markedDates() : cfg.markedDates)

  const refreshMarks = () => {
    calendar.clear_marks()
    const y = calendar.year
    const m = calendar.month
    const monthMarks = marks.filter(mark => mark.year === y && mark.month === m)

    for (const mark of marks) {
      if (mark.year === y && mark.month === m) {
        calendar.mark_day(mark.day)
      }
    }
  }

  refreshMarks()
  if (typeof cfg.markedDates === "function") {
    const accessor = cfg.markedDates
    const update = () => {
      const raw = accessor()
      marks = parseMarks(raw)
      refreshMarks()
    }
    update()
    accessor.subscribe(update)
  }
  calendar.connect("notify::month", () => refreshMarks())
  calendar.connect("notify::year", () => refreshMarks())

  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  content.append(calendar)

  const showEvents = cfg.showEvents !== false
  if (showEvents && typeof cfg.events === "function") {
    const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
    const maxItems = Number.isFinite(cfg.noEvents) ? Math.max(1, Math.floor(cfg.noEvents as number)) : 20
    content.append(list)
    createEffect(() => {
      const items = cfg.events?.() ?? []
      renderEventList(list, items, maxItems)
    }, { immediate: true })
  }

  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Calendar")
  return WidgetFrame(title, content)
}
