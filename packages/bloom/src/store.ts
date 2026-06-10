import { createState } from "ags"
import { timeout } from "ags/time"
import GLib from "gi://GLib"
import type { BloomSession, RunState, StageName } from "./types"

const STAGE_ORDER: StageName[] = ["sow", "grow", "plant"]

const STATE_FILE = `${GLib.get_home_dir()}/.cache/unclaimed-bloom/state.json`

const POLL_FAST_MS = 200
const AUTO_DISMISS_MS = 4000

const emptySession = (): BloomSession => ({
  profile: "",
  stages: {
    sow:   { status: "pending", runState: null },
    grow:  { status: "pending", runState: null },
    plant: { status: "pending", runState: null },
  },
  activeStage: null,
  overallStatus: "idle",
})

export const [bloomSession, setBloomSession] = createState<BloomSession>(emptySession())
export const [bloomVisible, setBloomVisible] = createState(false)

type TimerHandle = { cancel?(): void; stop?(): void; destroy?(): void }

let pollSourceId: number | null = null
let dismissTimer: TimerHandle | null = null
let sessionStartedAt = 0  // epoch ms; state.json older than this is from a previous run

// ── file reading ────────────────────────────────────────────────────────────

function readStateFile(): RunState | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(STATE_FILE)
    if (!ok || !bytes) return null
    return JSON.parse(new TextDecoder().decode(bytes)) as RunState
  } catch {
    return null
  }
}

// ── polling ──────────────────────────────────────────────────────────────────

function poll() {
  const raw = readStateFile()
  if (!raw) return

  const stage = raw.stage as StageName
  if (!["sow", "grow", "plant"].includes(stage)) return

  // Ignore state.json written before this session started (leftover from a previous run)
  if (new Date(raw.updated_at).getTime() < sessionStartedAt) return

  const session = bloomSession.peek()

  // Only process if this run_id is for the profile we're tracking,
  // OR we haven't seen any runs yet (handles manual testing without bloom-show)
  if (session.profile && raw.profile !== session.profile) return

  const stages = { ...session.stages }

  // If we're at stage X, all earlier stages must have completed (they ran too
  // fast to be caught by polling). Mark them done so the OSD reflects reality.
  const currentIdx = STAGE_ORDER.indexOf(stage)
  for (let i = 0; i < currentIdx; i++) {
    const prev = STAGE_ORDER[i]
    if (stages[prev].status === "pending") {
      stages[prev] = { status: "done", runState: null }
    }
  }

  stages[stage] = {
    status: raw.status === "running" ? "running"
          : raw.status === "done"    ? "done"
          : "error",
    runState: raw,
  }

  const overallStatus: BloomSession["overallStatus"] =
    raw.status === "error" ? "error" : "running"

  setBloomSession({
    ...session,
    stages,
    activeStage: raw.status === "running" ? stage : session.activeStage,
    overallStatus,
  })
}

function startPolling(intervalMs: number) {
  stopPolling()
  pollSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
    poll()
    return GLib.SOURCE_CONTINUE
  })
}

function stopPolling() {
  if (pollSourceId !== null) {
    GLib.source_remove(pollSourceId)
    pollSourceId = null
  }
}

function cancelDismiss() {
  dismissTimer?.cancel?.()
  dismissTimer?.stop?.()
  dismissTimer?.destroy?.()
  dismissTimer = null
}

function scheduleDismiss() {
  cancelDismiss()
  dismissTimer = timeout(AUTO_DISMISS_MS, () => {
    setBloomVisible(false)
    stopPolling()
    dismissTimer = null
  })
}

// ── public API ───────────────────────────────────────────────────────────────

export function showBloom(profile: string, wallpaper?: string) {
  cancelDismiss()
  sessionStartedAt = Date.now()
  setBloomSession({
    ...emptySession(),
    profile,
    wallpaper,
    overallStatus: "running",
  })
  setBloomVisible(true)
  startPolling(POLL_FAST_MS)
}

export function doneBloom() {
  stopPolling()
  // do one final read so the last plant state is captured
  poll()
  setBloomSession({
    ...bloomSession.peek(),
    overallStatus: "done",
  })
  scheduleDismiss()
}

export function hideBloom() {
  cancelDismiss()
  stopPolling()
  setBloomVisible(false)
}
