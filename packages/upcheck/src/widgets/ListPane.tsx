import { Gtk } from "ags/gtk4";
import UpdatesList from "./UpdatesList";

export default function ListPane() {
  return (
    <scrolledwindow
      class="list-scroll-view"
      vexpand={true}
      valign={Gtk.Align.FILL}
    >
      <UpdatesList />
    </scrolledwindow>
  )
}
