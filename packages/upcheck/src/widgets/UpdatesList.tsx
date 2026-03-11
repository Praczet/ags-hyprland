import { Gtk } from "ags/gtk4";
import { selectItem } from "../services/pacman";
import { updates } from "../store";
import { For } from "ags";

export default function UpdatesList() {
  return (
    <box
      class="updates-list"
      orientation={Gtk.Orientation.VERTICAL}
    >
      <For each={updates}>
        {(item) => (
          <UpdateRow item={item} />
        )}
      </For>
    </box>
  )
}

function UpdateRow({ item }: { item: UpItem }) {
  return (
    <button
      class="upcheck-row"
      onClicked={() => selectItem(item)}
    >
      <box hexpand spacing={12} class="row-content">
        <label class="pkg" xalign={0} hexpand label={item.name} />
        <label class="ver dim" xalign={1} label={item.oldVer} />
        <label class="ver new" xalign={1} label={item.newVer} />
      </box>
    </button>
  ) as Gtk.Button;
}

