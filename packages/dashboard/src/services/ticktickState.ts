import GLib from "gi://GLib"
import { createState } from "ags"
import { loadDashboardConfig } from "../config"
import { fetchProjectData, fetchProjects, fetchTaskById, type TickTickTaskItem } from "./ticktick"

export function initTickTickState() {
  const [tasks, setTasks] = createState<TickTickTaskItem[]>([])

  const refresh = async () => {
    const cfg = loadDashboardConfig().ticktick
    if (!cfg?.accessToken) return

    const projects = cfg.projectIds?.length
      ? cfg.projectIds.map(id => ({ id }))
      : await fetchProjects(cfg.accessToken)

    const items: TickTickTaskItem[] = []
    for (const p of projects) {
      if (!p.id) continue
      const data = await fetchProjectData(cfg.accessToken, p.id)
      const name = data?.project?.name ?? p.name
      const color = data?.project?.color ?? p.color
      const list = data?.tasks ?? []
      for (const t of list) {
        const status = t.status ?? 0
        if (cfg.showCompleted === false && status === 2) continue
        items.push({
          id: t.id ?? "",
          title: t.title ?? "(no title)",
          due: t.dueDate ?? t.startDate,
          status,
          projectId: t.projectId ?? p.id,
          projectName: name,
          projectColor: color,
        })
        if ((t.title ?? "").includes("TO FIX - Replace water tap filters")) {
          if (t.id && (t.projectId ?? p.id)) {
            await fetchTaskById(cfg.accessToken, t.projectId ?? p.id, t.id)
          }
        }
      }
    }

    setTasks(items)
  }

  refresh().catch(err => console.error("ticktick refresh error:", err))

  const refreshMins = cfgRefreshMins()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMins * 60 * 1000, () => {
    refresh().catch(err => console.error("ticktick refresh error:", err))
    return GLib.SOURCE_CONTINUE
  })

  function cfgRefreshMins() {
    const cfg = loadDashboardConfig().ticktick
    if (!cfg) return 5
    return Number.isFinite(Number(cfg.refreshMins)) ? Math.max(1, Math.floor(Number(cfg.refreshMins))) : 5
  }

  return { tasks, refresh }
}
