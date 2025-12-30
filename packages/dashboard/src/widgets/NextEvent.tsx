import { type Accessor, createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { CalendarEvent } from "../services/googleCalendar"
import { WidgetFrame } from "./WidgetFrame"
import { renderEventList } from "./eventList"

export type NextEventConfig = {
  title?: string
  showTitle?: boolean
  event?: Accessor<CalendarEvent | null>
  events?: Accessor<CalendarEvent[]>
  maxItems?: number
  useGoogle?: boolean
}

export function NextEventWidget(cfg: NextEventConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Next Event")

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

  const maxItems = Number.isFinite(cfg.maxItems) ? Math.max(1, Math.floor(cfg.maxItems as number)) : 20

  if (typeof cfg.events === "function") {
    createEffect(() => {
      const items = cfg.events?.() ?? []
      renderEventList(list, items, maxItems)
    }, { immediate: true })
  } else if (typeof cfg.event === "function") {
    createEffect(() => {
      const ev = cfg.event?.() ?? null
      renderEventList(list, ev ? [ev] : [], maxItems)
    }, { immediate: true })
  } else {
    renderEventList(list, [], maxItems)
  }

  const body = list as Gtk.Box

  return WidgetFrame(title, body)
}
