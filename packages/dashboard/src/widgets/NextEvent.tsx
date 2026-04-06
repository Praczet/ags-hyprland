import { type Accessor, createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { CalendarEvent } from "../services/googleCalendar"
import { WidgetFrame } from "./WidgetFrame"
import { renderEventList } from "./eventList"
import { makeAuthErrorView, type AuthErrorKind } from "./authError"

export type NextEventConfig = {
  title?: string
  showTitle?: boolean
  event?: Accessor<CalendarEvent | null>
  events?: Accessor<CalendarEvent[]>
  maxItems?: number
  useGoogle?: boolean
  authError?: Accessor<AuthErrorKind | null>
}

export function NextEventWidget(cfg: NextEventConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Next Event")

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

  const maxItems = Number.isFinite(cfg.maxItems) ? Math.max(1, Math.floor(cfg.maxItems as number)) : 20

  const clearContainer = () => {
    let child = container.get_first_child()
    while (child) { container.remove(child); child = container.get_first_child() }
  }

  if (typeof cfg.events === "function" || typeof cfg.authError === "function") {
    createEffect(() => {
      const err = cfg.authError?.() ?? null
      clearContainer()
      if (err) {
        container.append(makeAuthErrorView("google", err))
      } else {
        renderEventList(list, cfg.events?.() ?? [], maxItems)
        container.append(list)
      }
    }, { immediate: true })
  } else if (typeof cfg.event === "function") {
    createEffect(() => {
      const err = cfg.authError?.() ?? null
      clearContainer()
      if (err) {
        container.append(makeAuthErrorView("google", err))
      } else {
        const ev = cfg.event?.() ?? null
        renderEventList(list, ev ? [ev] : [], maxItems)
        container.append(list)
      }
    }, { immediate: true })
  } else {
    renderEventList(list, [], maxItems)
    container.append(list)
  }

  return WidgetFrame(title, container)
}
