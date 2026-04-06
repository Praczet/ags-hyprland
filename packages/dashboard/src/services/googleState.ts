import GLib from "gi://GLib"
import { type Accessor, createState } from "ags"
import { loadDashboardConfig } from "../config"
import { buildMarkedDates, fetchCalendarEvents, pickNextEvent, type CalendarEvent } from "./googleCalendar"
import { fetchTaskLists, fetchTasks, type TaskItem } from "./googleTasks"
import { AuthExpiredError } from "./googleAuth"

export type AuthErrorKind = "expired" | "offline"

export type GoogleCalendarState = {
  markedDates: Accessor<string[]>
  nextEvent: Accessor<CalendarEvent | null>
  events: Accessor<CalendarEvent[]>
  tasks: Accessor<TaskItem[]>
  taskListTitle: Accessor<string | null>
  authError: Accessor<AuthErrorKind | null>
  refresh: () => Promise<void>
}

export function initGoogleCalendarState(): GoogleCalendarState {
  const [markedDates, setMarkedDates] = createState<string[]>([])
  const [nextEvent, setNextEvent] = createState<CalendarEvent | null>(null)
  const [events, setEvents] = createState<CalendarEvent[]>([])
  const [tasks, setTasks] = createState<TaskItem[]>([])
  const [taskListTitle, setTaskListTitle] = createState<string | null>(null)
  const [authError, setAuthError] = createState<AuthErrorKind | null>(null)

  const refresh = async () => {
    const cfg = loadDashboardConfig().google
    if (!cfg) return

    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 45).toISOString()

    try {
      const events = await fetchCalendarEvents(cfg.calendars, timeMin, timeMax, 250)
      const marks = buildMarkedDates(events)
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const inMonth = marks.filter(d => d.startsWith(ym))
      setMarkedDates(marks)
      setNextEvent(pickNextEvent(events, timeMin))
      setEvents(events)

      if (cfg.taskListId) {
        const items = await fetchTasks(cfg.taskListId, cfg.taskMaxItems ?? 20, cfg.taskShowCompleted ?? false)
        setTasks(items)
      } else {
        const lists = await fetchTaskLists()
        const first = lists[0]
        if (first?.id) {
          const items = await fetchTasks(first.id, cfg.taskMaxItems ?? 20, cfg.taskShowCompleted ?? false)
          setTasks(items)
          setTaskListTitle(first.title ?? null)
        }
      }

      setAuthError(null)
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        setAuthError("expired")
      } else {
        setAuthError("offline")
      }
      console.error("google calendar refresh:", err)
    }
  }

  refresh()

  const refreshMins = cfgRefreshMins()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMins * 60 * 1000, () => {
    refresh()
    return GLib.SOURCE_CONTINUE
  })

  function cfgRefreshMins() {
    const cfg = loadDashboardConfig().google
    if (!cfg) return 10
    return Number.isFinite(Number(cfg.refreshMins)) ? Math.max(1, Math.floor(Number(cfg.refreshMins))) : 10
  }

  return { markedDates, nextEvent, events, tasks, taskListTitle, authError, refresh }
}
