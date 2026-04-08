import type { Accessor } from "ags"
import { Gtk } from "ags/gtk4"
import ClipList from "./ClipList"
import ClipSearcher from "./ClipSearcher"
import type { ClipEntry } from "../types"

export function ClipPicker(props: { clipboardItems: Accessor<ClipEntry[]> }) {
  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      halign={Gtk.Align.FILL}
    >
      <ClipSearcher clipboardItems={props.clipboardItems} />
      <ClipList clipboardItems={props.clipboardItems} />
    </box>
  )
}
