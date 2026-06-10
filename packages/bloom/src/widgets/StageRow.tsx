import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { bloomSession } from "../store"
import type { StageName, StageRecord } from "../types"

function statusIcon(status: StageRecord["status"]): string {
  switch (status) {
    case "running": return "⟳"
    case "done":    return "✓"
    case "error":   return "✗"
    default:        return "⋯"
  }
}

function elapsedText(record: StageRecord): string {
  if (!record.runState || record.status === "pending") return ""
  const start = new Date(record.runState.started_at).getTime()
  const end = record.status === "running"
    ? Date.now()
    : new Date(record.runState.updated_at).getTime()
  const ms = Math.max(0, end - start)
  return ms < 10000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`
}

function countText(record: StageRecord): string {
  if (!record.runState || record.status === "pending") return ""
  const targets = Object.values(record.runState.targets)
  const total = targets.length
  if (total === 0) return ""
  if (record.status === "done" || record.status === "error") {
    return `(${total} targets)`
  }
  const done = targets.filter(t =>
    t.status === "done" || t.status === "skipped" || t.status === "error"
  ).length
  return `${done}/${total}`
}

function currentTarget(record: StageRecord): string {
  if (!record.runState || record.status !== "running") return ""
  const entry = Object.entries(record.runState.targets).find(([, t]) => t.status === "running")
  return entry ? `(${entry[0]})` : ""
}

export function StageRow({ stage }: { stage: StageName }) {
  const record  = createComputed(() => bloomSession().stages[stage])
  const icon    = createComputed(() => statusIcon(record().status))
  const elapsed = createComputed(() => elapsedText(record()))
  const count   = createComputed(() => countText(record()))
  const current = createComputed(() => currentTarget(record()))
  const rowClass = createComputed(() => `bloom-row bloom-row-${record().status}`)

  return (
    <box class={rowClass} orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
      <label class="bloom-row-icon" label={icon} widthChars={2} xalign={0} />
      <label class="bloom-row-stage" label={stage} widthChars={6} xalign={0} />
      <label class="bloom-row-time" label={elapsed} widthChars={6} xalign={1} />
      <label class="bloom-row-count" label={count} widthChars={12} xalign={0} />
      <label class="bloom-row-target" label={current} xalign={0} widthChars={16} maxWidthChars={16} ellipsize={3} />
    </box>
  )
}
