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

export function TasksWidget(cfg: TasksConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Tasks")
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

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

    for (const t of items) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
      row.add_css_class("dashboard-task-row")
      const title = new Gtk.Label({ label: t.title || "(no title)", xalign: 0 })
      const due = new Gtk.Label({ label: formatDue(t.due), xalign: 1 })
      due.add_css_class("dashboard-task-due")
      row.append(title)
      if (t.due) row.append(due)
      list.append(row)
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

  return WidgetFrame(title, list)
}
