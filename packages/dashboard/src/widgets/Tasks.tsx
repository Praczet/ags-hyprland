import { type Accessor, createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import { WidgetFrame } from "./WidgetFrame"
import type { TaskItem } from "../services/googleTasks"

export type TasksConfig = {
  title?: string
  showTitle?: boolean
  tasks?: Accessor<TaskItem[]>
  listTitle?: Accessor<string | null>
  maxItems?: number
  useGoogle?: boolean
}

function formatDue(due?: string) {
  if (!due) return ""
  return due.slice(0, 10)
}

function groupTasks(items: TaskItem[]) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)

  const groups: Record<string, TaskItem[]> = {
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

export function TasksWidget(cfg: TasksConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Tasks")
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const scroller = new Gtk.ScrolledWindow({
    vexpand: true,
    hexpand: true,
    child: list,
  })
  scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const renderList = (items: TaskItem[], listTitle?: string | null) => {
    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }

    if (listTitle) {
      const head = new Gtk.Label({ label: listTitle, xalign: 0 })
      head.add_css_class("dashboard-tasks-list-title")
      list.append(head)
    }

    if (!items.length) {
      list.append(new Gtk.Label({ label: "No tasks", xalign: 0 }))
      return
    }

    const groups = groupTasks(items)
    const order = ["Overdue", "Today", "Tomorrow", "Future"] as const

    for (const name of order) {
      const groupItems = groups[name]
      if (!groupItems.length) continue

      const header = new Gtk.Label({ label: name, xalign: 0 })
      header.add_css_class("dashboard-task-group")
      list.append(header)

      for (const t of groupItems) {
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

  const maxItems = Number.isFinite(cfg.maxItems) ? Math.max(1, Math.floor(cfg.maxItems as number)) : 20

  if (cfg.useGoogle === false) {
    renderList([], null)
  } else if (typeof cfg.tasks === "function") {
    createEffect(() => {
      const items = cfg.tasks?.() ?? []
      const listTitle = typeof cfg.listTitle === "function" ? cfg.listTitle() : null
      renderList(items.slice(0, maxItems), listTitle)
    }, { immediate: true })
  } else {
    renderList([], null)
  }

  return WidgetFrame(title, scroller)
}
