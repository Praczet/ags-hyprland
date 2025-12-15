import { Gdk, Gtk } from "ags/gtk4";
import { ClipEntry } from "../types";
import { setSearchTerm, searchTerm, showOnlyStarred, setShowOnlyStarred } from "../store";
import { Accessor } from "ags";

export default function ClipSearcher(props: { clipboardItems: Accessor<ClipEntry[]>; }) {
  return (
    <box
      orientation={Gtk.Orientation.HORIZONTAL}
      name="search-box"
      spacing={6}
      halign={Gtk.Align.CENTER}
      class="mcm-search-container"
    >
      <entry
        placeholderText="Search..."
        focusable={true}
        text={searchTerm()}
        onNotifyText={(self) => setSearchTerm(self.text || "")}
        onMap={(self) => self.grab_focus()}
        $={(self) => {
          const key = new Gtk.EventControllerKey();
          key.connect("key-pressed", (_, keyval, _keycode, state) => {
            // Ctrl+Shift+S → toggle starred filter
            if (
              keyval === Gdk.KEY_s &&
              (state & Gdk.ModifierType.ALT_MASK)
            ) {
              console.log("Toggling starred filter via Ctrl+Shift+S");
              setShowOnlyStarred(!showOnlyStarred());
              return true;
            }

            if (keyval === Gdk.KEY_Down) {
              const picker = self.get_parent()?.get_parent(); // Box in ClipPicker
              const list = picker?.get_last_child(); // Should be ClipList (FlowBox)
              if (list instanceof Gtk.FlowBox) {
                list.child_focus(Gtk.DirectionType.TAB_FORWARD);
                return true;
              }
            }
            return false;
          });
          self.add_controller(key);
        }}
      ></entry>
      <button
        name="starred-button"
        valign={Gtk.Align.CENTER}

        // checkable={true}
        onClicked={() => {
          const current = showOnlyStarred();
          setShowOnlyStarred(!current);
        }
        }
      >
        <image iconName="starred-symbolic" iconSize={Gtk.IconSize.NORMAL} />
      </button>
    </box>
  )
}
