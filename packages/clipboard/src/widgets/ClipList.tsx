/**
 * MyClipList.tsx
 * 
 * Renders a scrollable list of clipboard items using Gtk.FlowBox.
 * Handles keyboard shortcuts for starring, deleting, and searching clips.
 * 
 * Props:
 *   clipboardItems: Accessor<ClipEntry[]>
 */

import { Gdk, Gtk } from "ags/gtk4";
import ClipCard from "./ClipCard";
import { deleteClip, restoreClipToClipboard, toggleClipStar } from "../vault";
import { ClipEntry, ClipTypes } from "../types";
import { Accessor, For } from "ags";

export default function ClipList(props: { clipboardItems: Accessor<ClipEntry[]>; }) {
  return (
    <scrolledwindow
      maxContentHeight={200}
      hexpand={true}
      heightRequest={180}
      vexpand={false}


    >
      <Gtk.FlowBox
        selectionMode={Gtk.SelectionMode.SINGLE}
        columnSpacing={10}
        maxChildrenPerLine={1000}
        canFocus={true}
        focusable={true}
        onChildActivated={(self, child) => {
          const index = child.get_index();
          const items = props.clipboardItems();
          const item = items[index] as ClipEntry | undefined;
          if (!item) return;
          (async () => {
            await restoreClipToClipboard(item.id);
          })();
        }}
        $={(self) => {
          const key = new Gtk.EventControllerKey();
          key.connect("key-pressed", (_, keyval, keycode, state) => {

            if (keyval === Gdk.KEY_s && (state & Gdk.ModifierType.CONTROL_MASK)) {
              const selected = self.get_selected_children();
              const child = selected[0];
              if (!child) return true;
              const index = child.get_index();
              const items = props.clipboardItems();
              const item = items[index] as ClipEntry | undefined;
              if (!item) return true;
              (async () => {
                await toggleClipStar(item.id);
              })();
              return true;
            }

            // Shift+Delete → delete selected item
            if (keyval === Gdk.KEY_Delete && (state & Gdk.ModifierType.SHIFT_MASK)) {
              const selected = self.get_selected_children();
              const child = selected[0];
              if (!child) return true;
              const index = child.get_index();
              const items = props.clipboardItems();
              const item = items[index] as ClipEntry | undefined;
              if (!item) return true;
              deleteClip(item.id);
              return true;
            }

            // If a printable character (rough approximation), capture it
            const char = Gdk.keyval_to_unicode(keyval);
            if (char && char > 31 && !(state & Gdk.ModifierType.CONTROL_MASK)) {
              const picker = self.get_parent()?.get_parent()?.get_parent(); // Box in MyClipPicker
              const searcher = picker?.get_first_child(); // Box (Searcher)
              const entry = searcher?.get_first_child(); // Entry

              if (entry instanceof Gtk.Entry) {
                entry.grab_focus();
                entry.set_text(entry.get_text() + String.fromCharCode(char));
                entry.set_position(-1); // Move cursor to end
                return true;
              }
            }
            return false;
          });
          self.add_controller(key);
        }}
      >
        <For each={props.clipboardItems}>
          {(entry) => (
            <Gtk.FlowBoxChild focusable={true}>
              <MyClip entry={entry} />
            </Gtk.FlowBoxChild>
          )}
        </For>
      </Gtk.FlowBox>
    </scrolledwindow>
  )
}
