import { fetch, URL } from "ags/fetch"

export type TickTickProject = {
  id?: string
  name?: string
  color?: string
  closed?: boolean
}

export type TickTickTask = {
  id?: string
  projectId?: string
  title?: string
  dueDate?: string
  startDate?: string
  status?: number
}

export type TickTickProjectData = {
  project?: TickTickProject
  tasks?: TickTickTask[]
}

export type TickTickTaskItem = {
  id: string
  title: string
  due?: string
  status?: number
  projectId?: string
  projectName?: string
  projectColor?: string
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function fetchProjects(token: string): Promise<TickTickProject[]> {
  const url = new URL("https://api.ticktick.com/open/v1/project")
  const res = await fetch(url, { method: "GET", headers: authHeaders(token) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`TickTick projects failed: ${res.status} ${txt}`)
  }
  const json = await res.json() as TickTickProject[]
  return Array.isArray(json) ? json : []
}

export async function fetchProjectData(token: string, projectId: string): Promise<TickTickProjectData | null> {
  const url = new URL(`https://api.ticktick.com/open/v1/project/${encodeURIComponent(projectId)}/data`)
  const res = await fetch(url, { method: "GET", headers: authHeaders(token) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`TickTick project data failed: ${projectId}: ${res.status} ${txt}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as TickTickProjectData | null
}

export async function fetchTaskById(token: string, projectId: string, taskId: string) {
  const url = new URL(`https://api.ticktick.com/open/v1/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`)
  const res = await fetch(url, { method: "GET", headers: authHeaders(token) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`TickTick task fetch failed: ${taskId}: ${res.status} ${txt}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}
