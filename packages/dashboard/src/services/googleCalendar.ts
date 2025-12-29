import { fetch, URL } from "ags/fetch"
import GLib from "gi://GLib"
import { getAccessToken } from "./googleAuth"
import type { CalendarSource } from "../config"

export type CalendarEvent = {
  id: string
  calendarId: string
  summary: string
  start: string
  end: string
  color?: string
  label?: string
}

type GoogleEvent = {
  id?: string
  summary?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

type EventsResponse = {
  items?: GoogleEvent[]
}

function pickDate(start?: { date?: string; dateTime?: string }) {
  return start?.dateTime ?? start?.date ?? ""
}

function toTimestamp(isoOrDate: string): number {
  if (!isoOrDate) return Number.NaN
  let dt = GLib.DateTime.new_from_iso8601(isoOrDate, null)
  if (!dt && isoOrDate.length === 10) {
    dt = GLib.DateTime.new_from_iso8601(`${isoOrDate}T00:00:00`, null)
  }
  if (!dt) return Number.NaN
  return dt.to_unix() * 1000
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const at = toTimestamp(a.start)
    const bt = toTimestamp(b.start)
    if (Number.isFinite(at) && Number.isFinite(bt)) return at - bt
    return a.start.localeCompare(b.start)
  })
}

export async function fetchCalendarEvents(
  calendars: CalendarSource[],
  timeMin: string,
  timeMax: string,
  maxResults = 250,
): Promise<CalendarEvent[]> {
  const token = await getAccessToken()
  const headers = { Authorization: `Bearer ${token}` }

  const results: CalendarEvent[] = []

  for (const cal of calendars) {
    const id = encodeURIComponent(cal.id).replaceAll("@", "%40")
    const base = `https://www.googleapis.com/calendar/v3/calendars/${id}/events`
    const qs = [
      `maxResults=${encodeURIComponent(String(maxResults))}`,
      "singleEvents=true",
      `timeMax=${encodeURIComponent(timeMax)}`,
      `timeMin=${encodeURIComponent(timeMin)}`,
    ].join("&")
    const urlStr = `${base}?${qs}`

    const res = await fetch(new URL(urlStr), { method: "GET", headers })
    if (!res.ok) {
      const txt = await res.text()
      console.error("[googleCalendar] error", cal.id, res.status, txt)
      throw new Error(`Calendar fetch failed: ${cal.id}: ${res.status} ${txt}`)
    }
    const json = await res.json() as EventsResponse
    const items = json.items ?? []
    for (const item of items) {
      const start = pickDate(item.start)
      const end = pickDate(item.end)
      if (!start) continue
      results.push({
        id: item.id ?? `${cal.id}:${start}`,
        calendarId: cal.id,
        summary: item.summary ?? "(no title)",
        start,
        end,
        color: cal.color,
        label: cal.label,
      })
    }
  }

  return sortEvents(results)
}

export function buildMarkedDates(events: CalendarEvent[]): string[] {
  const set = new Set<string>()
  for (const ev of events) {
    const date = ev.start.slice(0, 10)
    if (date) set.add(date)
  }
  return Array.from(set).sort()
}

export function pickNextEvent(events: CalendarEvent[], nowIso: string): CalendarEvent | null {
  const now = toTimestamp(nowIso)
  const future = events
    .map(e => ({ e, t: toTimestamp(e.start) }))
    .filter(x => Number.isFinite(x.t) && x.t >= now)
    .sort((a, b) => a.t - b.t)
  return future.length ? future[0].e : null
}
