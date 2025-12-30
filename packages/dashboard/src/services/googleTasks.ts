import { fetch, URL } from "ags/fetch"
import { getAccessToken } from "./googleAuth"

export type TaskItem = {
  id: string
  title: string
  due?: string
  status?: string
  listId?: string
  listTitle?: string
}

type TaskList = {
  id?: string
  title?: string
}

type TaskListsResponse = {
  items?: TaskList[]
}

type Task = {
  id?: string
  title?: string
  due?: string
  status?: string
}

type TasksResponse = {
  items?: Task[]
}

export async function fetchTaskLists(): Promise<TaskList[]> {
  const token = await getAccessToken()
  const url = new URL("https://tasks.googleapis.com/tasks/v1/users/@me/lists")
  const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Task lists fetch failed: ${res.status} ${txt}`)
  }
  const json = await res.json() as TaskListsResponse
  return json.items ?? []
}

export async function fetchTasks(listId: string, maxResults = 20, showCompleted = false): Promise<TaskItem[]> {
  const token = await getAccessToken()
  const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`)
  url.searchParams.set("maxResults", String(maxResults))
  url.searchParams.set("showCompleted", showCompleted ? "true" : "false")
  url.searchParams.set("showHidden", "false")

  const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Tasks fetch failed: ${res.status} ${txt}`)
  }
  const json = await res.json() as TasksResponse
  const items = json.items ?? []
  return items.map(t => ({
    id: t.id ?? "",
    title: t.title ?? "(no title)",
    due: t.due,
    status: t.status,
  }))
}
