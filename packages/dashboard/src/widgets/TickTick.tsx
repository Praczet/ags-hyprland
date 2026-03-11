import { type Accessor, createEffect } from "ags"
import { Gdk, Gtk } from "ags/gtk4"
import { WidgetFrame } from "./WidgetFrame"
import type { TickTickTaskItem } from "../services/ticktick"

export type TickTickMode = "tasks" | "projects"

export type TickTickConfig = {
  title?: string
  showTitle?: boolean
  tasks?: Accessor<TickTickTaskItem[]>
  mode?: TickTickMode
  maxItems?: number
}

function formatDue(due?: string) {
  if (!due) return ""
  return due.slice(0, 10)
}

function groupByDate(items: TickTickTaskItem[]) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)

  const groups: Record<string, TickTickTaskItem[]> = {
    Overdue: [],
    Today: [],
    Tomorrow: [],
    Future: [],
  }

  for (const t of items) {
    const due = formatDue(t.due)
    if (!due) {
      groups.Future.push(t)
      continue
    }
    if (due < today) groups.Overdue.push(t)
    else if (due === today) groups.Today.push(t)
    else if (due === tomorrow) groups.Tomorrow.push(t)
    else groups.Future.push(t)
  }

  return groups
}

function parseColor(input?: string) {
  const c = new Gdk.RGBA()
  if (input && c.parse(input)) return c
  c.parse("#86d1e9")
  return c
}

export function TickTickWidget(cfg: TickTickConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "TickTick")
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const scroller = new Gtk.ScrolledWindow({
    vexpand: true,
    hexpand: true,
    child: list,
  })
  scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const renderTasksMode = (items: TickTickTaskItem[], maxItems: number) => {
    const groups = groupByDate(items)
    const order = ["Overdue", "Today", "Tomorrow", "Future"] as const

    for (const name of order) {
      const groupItems = groups[name]
      if (!groupItems.length) continue

      const header = new Gtk.Label({ label: name, xalign: 0 })
      header.add_css_class("dashboard-task-group")
      list.append(header)

      for (const t of groupItems.slice(0, maxItems)) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
        row.add_css_class("dashboard-task-row")
        if (name === "Overdue") row.add_css_class("dashboard-task-overdue")
        if (name === "Today") row.add_css_class("dashboard-task-today")
        const title = new Gtk.Label({ label: t.title || "(no title)", xalign: 0 })
        title.add_css_class("dashboard-task-title")
        const due = new Gtk.Label({ label: formatDue(t.due), xalign: 1 })
        due.add_css_class("dashboard-task-due")
        row.append(title)
        if (t.due) row.append(due)
        list.append(row)
      }
    }
  }

  const renderProjectsMode = (items: TickTickTaskItem[], maxItems: number) => {
    const byProject = new Map<string, TickTickTaskItem[]>()
    for (const t of items) {
      const key = t.projectName ?? t.projectId ?? "Project"
      if (!byProject.has(key)) byProject.set(key, [])
      byProject.get(key)!.push(t)
    }

    for (const [name, tasks] of byProject.entries()) {
      const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
      header.add_css_class("dashboard-task-group")
      const color = parseColor(tasks[0]?.projectColor)
      const bar = new Gtk.DrawingArea({ content_width: 4 })
      bar.set_draw_func((_area, cr, width, height) => {
        cr.setSourceRGBA(color.red, color.green, color.blue, 1)
        cr.rectangle(0, 0, width, height)
        cr.fill()
      })
      header.append(bar)
      header.append(new Gtk.Label({ label: name, xalign: 0 }))
      list.append(header)

      for (const t of tasks.slice(0, maxItems)) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
        row.add_css_class("dashboard-task-row")
        const title = new Gtk.Label({ label: t.title || "(no title)", xalign: 0 })
        title.add_css_class("dashboard-task-title")
        const due = new Gtk.Label({ label: formatDue(t.due), xalign: 1 })
        due.add_css_class("dashboard-task-due")
        row.append(title)
        if (t.due) row.append(due)
        list.append(row)
      }
    }
  }

  const renderList = (items: TickTickTaskItem[]) => {
    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }
    if (!items.length) {
      list.append(new Gtk.Label({ label: "No tasks", xalign: 0 }))
      return
    }

    const maxItems = Number.isFinite(cfg.maxItems) ? Math.max(1, Math.floor(cfg.maxItems as number)) : 20
    if (cfg.mode === "projects") {
      renderProjectsMode(items, maxItems)
    } else {
      renderTasksMode(items, maxItems)
    }
  }

  if (typeof cfg.tasks === "function") {
    createEffect(() => {
      const items = cfg.tasks?.() ?? []
      renderList(items)
    }, { immediate: true })
  } else {
    renderList([])
  }

  return WidgetFrame(title, scroller)
}
