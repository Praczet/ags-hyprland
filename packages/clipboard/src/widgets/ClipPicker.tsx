import { Gtk } from "ags/gtk4";
import MyClipList from "./MyClipList";
import { MyClipEntry } from "./MyClip";
import MyClipSearcher from "./MyClipSearcher";
import { Accessor } from "ags";

export default function MyClipPicker(props: { clipboardItems: Accessor<MyClipEntry[]>; }) {
  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      halign={Gtk.Align.FILL}
    >
      <MyClipSearcher clipboardItems={props.clipboardItems} />
      <MyClipList clipboardItems={props.clipboardItems} />
    </box>
  )
}
