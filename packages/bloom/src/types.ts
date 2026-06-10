// Mirrors src/deno/core/events/EventEmitter.ts RunState shape
export type StageStatus = "pending" | "running" | "done" | "error" | "skipped"
export type RunStatus = "running" | "done" | "error"

export interface WorkerProgress {
  current: number
  total: number
  pct: number
  msg?: string
}

export interface TargetState {
  status: StageStatus
  duration_ms?: number
  worker?: WorkerProgress
}

export interface RunState {
  run_id: string
  profile: string
  stage: string
  status: RunStatus
  started_at: string
  updated_at: string
  targets: Record<string, TargetState>
}

export type StageName = "sow" | "grow" | "plant"

export interface StageRecord {
  status: "pending" | "running" | "done" | "error"
  runState: RunState | null
}

export interface BloomSession {
  profile: string
  wallpaper?: string
  stages: Record<StageName, StageRecord>
  activeStage: StageName | null
  overallStatus: "running" | "done" | "error" | "idle"
}
