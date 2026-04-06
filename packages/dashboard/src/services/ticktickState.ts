import GLib from "gi://GLib"
import { createState } from "ags"
import { loadDashboardConfig } from "../config"
import { fetchProjectData, fetchProjects, fetchTaskById, TickTickAuthError, type TickTickTaskItem } from "./ticktick"
import type { AuthErrorKind } from "./googleState"
import { lookupSecret } from "../../../../shared/utils/secrets"

export function initTickTickState() {
  const [tasks, setTasks] = createState<TickTickTaskItem[]>([])
  const [authError, setAuthError] = createState<AuthErrorKind | null>(null)

  const refresh = async () => {
    const cfg = loadDashboardConfig().ticktick
    // Keyring-first with config fallback for migration
    const accessToken = await lookupSecret("ticktick") ?? cfg?.accessToken
    if (!accessToken) return

    try {
      const projects = cfg?.projectIds?.length
        ? cfg.projectIds.map(id => ({ id }))
        : await fetchProjects(accessToken)

      const items: TickTickTaskItem[] = []
      for (const p of projects) {
        if (!p.id) continue
        const data = await fetchProjectData(accessToken, p.id)
        const name = data?.project?.name ?? p.name
        const color = data?.project?.color ?? p.color
        const list = data?.tasks ?? []
        for (const t of list) {
          const status = t.status ?? 0
          if (cfg?.showCompleted === false && status === 2) continue
          items.push({
            id: t.id ?? "",
            title: t.title ?? "(no title)",
            due: t.dueDate ?? t.startDate,
            status,
            projectId: t.projectId ?? p.id,
            projectName: name,
            projectColor: color,
          })
        }
      }

      setTasks(items)
      setAuthError(null)
    } catch (err) {
      if (err instanceof TickTickAuthError) {
        setAuthError("expired")
      } else {
        setAuthError("offline")
      }
      console.error("ticktick refresh error:", err)
    }
  }

  refresh()

  const refreshMins = cfgRefreshMins()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMins * 60 * 1000, () => {
    refresh()
    return GLib.SOURCE_CONTINUE
  })

  function cfgRefreshMins() {
    const cfg = loadDashboardConfig().ticktick
    if (!cfg) return 5
    return Number.isFinite(Number(cfg.refreshMins)) ? Math.max(1, Math.floor(Number(cfg.refreshMins))) : 5
  }

  return { tasks, authError, refresh }
}
