import { Gtk } from "ags/gtk4";
import DetailsPane from "./DetailsPane";
import ListPane from "./ListPane";
import ButtonsPane from "./ButtonsPane";
import { updates } from "../store";

export default function MainView() {
  return (
    <box
      class="main-view"
      orientation={Gtk.Orientation.VERTICAL}
      heightRequest={600}
      vexpand={true}
      valign={Gtk.Align.FILL}
      spacing={20}
    >
      <label
        class="pane-title"
        label={updates.as(u => `Updates Available: ${u.length}`)}
      />
      <box
        class="main-content"
        orientation={Gtk.Orientation.HORIZONTAL}
        hexpand={true}
        halign={Gtk.Align.FILL}
        homogeneous={true}
      >
        <ListPane />
        <DetailsPane />
      </box>
      <ButtonsPane />
    </box >
  )
}
