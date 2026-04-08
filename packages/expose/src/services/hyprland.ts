import { execAsync } from "ags/process"
import type { ExposeClient } from "../store"

const MAGIC_WORKSPACE_ID = -98
const FLOAT_SCRATCH_NAME = "expose-float"
const FLOAT_SCRATCH_TARGET = `special:${FLOAT_SCRATCH_NAME}`

type HyprClientJson = {
  address?: string
  title?: string
  class?: string
  workspace?: { id?: number }
  pid?: number
  at?: [number?, number?]
  size?: [number?, number?]
  floating?: boolean
  mapped?: boolean
}

export type WorkspacePrepContext = {
  clients: ExposeClient[]
  magicWasActive: boolean
  floaters: Array<{
    address: string
    workspaceId: number
  }>
}

export async function listClients(): Promise<ExposeClient[]> {
  const out = await execAsync(["hyprctl", "-j", "clients"])
  const raw = JSON.parse(out) as HyprClientJson[]
  return raw
    .filter(client => !!client.address && (client.mapped ?? true))
    .map(client => ({
      address: client.address as string,
      title: (client.title ?? "") as string,
      class: (client.class ?? "") as string,
      workspaceId: (client.workspace?.id ?? -1) as number,
      pid: (client.pid ?? -1) as number,
      at: [client.at?.[0] ?? 0, client.at?.[1] ?? 0],
      size: [client.size?.[0] ?? 0, client.size?.[1] ?? 0],
      floating: Boolean(client.floating),
      thumb: undefined,
    }))
}

export async function activeWorkspaceId() {
  const out = await execAsync(["hyprctl", "-j", "activeworkspace"])
  return (JSON.parse(out)?.id ?? -1) as number
}

export async function focusWindow(address: string) {
  await execAsync(["hyprctl", "dispatch", "focuswindow", `address:${address}`])
}

async function moveWindowToWorkspace(address: string, workspace: string) {
  await execAsync(["hyprctl", "dispatch", "movetoworkspacesilent", workspace, `address:${address}`])
}

async function toggleSpecialWorkspace(name: string) {
  await execAsync(["hyprctl", "dispatch", "togglespecialworkspace", name])
}

export async function prepareWorkspace(sleep: (ms: number) => Promise<void>): Promise<WorkspacePrepContext> {
  let activeId = await activeWorkspaceId()
  let magicWasActive = false
  if (activeId === MAGIC_WORKSPACE_ID) {
    try {
      await toggleSpecialWorkspace("magic")
      magicWasActive = true
      await sleep(120)
    } catch (error) {
      console.error("toggle magic workspace error", error)
    }
    activeId = await activeWorkspaceId()
  }

  const snapshot = await listClients()
  const floaters = snapshot.filter(client => client.workspaceId === activeId && client.floating)

  for (const floater of floaters) {
    try {
      await moveWindowToWorkspace(floater.address, FLOAT_SCRATCH_TARGET)
    } catch (error) {
      console.error("move floater to scratch", error)
    }
  }

  return {
    clients: snapshot,
    magicWasActive,
    floaters: floaters.map(floater => ({ address: floater.address, workspaceId: floater.workspaceId })),
  }
}

export async function restoreWorkspace(ctx: WorkspacePrepContext | null) {
  if (!ctx) return
  for (const floater of ctx.floaters) {
    try {
      await moveWindowToWorkspace(floater.address, `${floater.workspaceId}`)
    } catch (error) {
      console.error("restore floater", { address: floater.address, error })
    }
  }
  if (ctx.magicWasActive) {
    try {
      await toggleSpecialWorkspace("magic")
    } catch (error) {
      console.error("restore magic workspace", error)
    }
  }
}

export async function withScratchWorkspace<T>(sleep: (ms: number) => Promise<void>, fn: () => Promise<T>) {
  await toggleSpecialWorkspace(FLOAT_SCRATCH_NAME)
  await sleep(80)
  try {
    return await fn()
  } finally {
    await toggleSpecialWorkspace(FLOAT_SCRATCH_NAME)
    await sleep(40)
  }
}
