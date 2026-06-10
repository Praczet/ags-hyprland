import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import Pango from "gi://Pango"
import { bloomSession } from "../store"
import type { StageName, WorkerProgress } from "../types"

function findActiveWorker(stage: StageName): WorkerProgress | null {
  const record = bloomSession().stages[stage]
  if (!record.runState || record.status !== "running") return null
  for (const target of Object.values(record.runState.targets)) {
    if (target.worker && target.worker.total > 0) return target.worker
  }
  return null
}

export function WorkerBar({ stage }: { stage: StageName }) {
  const worker  = createComputed(() => findActiveWorker(stage))
  const visible = createComputed(() => worker() !== null)
  const value   = createComputed(() => worker()?.pct ?? 0)
  const msg     = createComputed(() => worker()?.msg ?? "")

  return (
    <box class="bloom-worker" orientation={Gtk.Orientation.HORIZONTAL} spacing={8} visible={visible}>
      <Gtk.LevelBar
        class="bloom-worker-bar"
        mode={Gtk.LevelBarMode.CONTINUOUS}
        minValue={0}
        maxValue={1}
        value={value}
        hexpand={true}
      />
      <label
        class="bloom-worker-msg"
        label={msg}
        maxWidthChars={28}
        ellipsize={Pango.EllipsizeMode.END}
        xalign={0}
      />
    </box>
  )
}
