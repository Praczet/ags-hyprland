import { Gtk } from "ags/gtk4";
import ClipList from "./ClipList";
import { ClipEntry } from "../types";
import ClipSearcher from "./ClipSearcher";
import { Accessor } from "ags";

export default function ClipPicker(props: { clipboardItems: Accessor<ClipEntry[]>; }) {
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
