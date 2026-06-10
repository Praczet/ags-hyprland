import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import GLib from "gi://GLib"
import { bloomSession, hideBloom } from "../store"

const REPORTS_DIR = `${GLib.get_home_dir()}/.cache/unclaimed-bloom/reports/`

export function CompletionRow() {
  const status  = createComputed(() => bloomSession().overallStatus)
  const visible = createComputed(() => status() === "done" || status() === "error")
  const isDone  = createComputed(() => status() === "done")
  const isError = createComputed(() => status() === "error")

  return (
    <box class="bloom-completion" orientation={Gtk.Orientation.VERTICAL} spacing={4} visible={visible}>
      <label
        class="bloom-completion-done"
        label={`✓ Done  —  ${REPORTS_DIR}`}
        visible={isDone}
        xalign={0}
        ellipsize={1}
      />
      <box
        class="bloom-completion-error"
        orientation={Gtk.Orientation.HORIZONTAL}
        spacing={8}
        visible={isError}
      >
        <label
          class="bloom-completion-error-label"
          label="✗ Error occurred"
          xalign={0}
          hexpand={true}
        />
        <button class="bloom-completion-dismiss" onClicked={hideBloom}>
          <label label="dismiss" />
        </button>
      </box>
    </box>
  )
}
