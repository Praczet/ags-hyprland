export type ExposeClient = {
  address: string
  title: string
  class: string
  workspaceId: number
  pid: number
  at: [number, number]
  size: [number, number]
  floating: boolean
  thumb?: string
}

export const cfg = {
  refreshMs: 1200,
  heavyModeThreshold: 28,
}

