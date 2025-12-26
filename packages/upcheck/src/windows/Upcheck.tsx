import { Astal, Gtk } from "ags/gtk4";
import MainView from "../widgets/MainView";
import { refreshUpdates } from "../store";
import Gdk from "gi://Gdk";

export default function Upcheck(defaultMonitor = 0) {
  const monitor = defaultMonitor;
  const win = (
    <window
      name="upcheck"
      namespace="adart-upcheck"
      class="upcheck-window"
      visible={false}
      monitor={monitor}
      margin_bottom={20}
      widthRequest={1400}
      margin_top={20}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM}

      $={(_self: Astal.Window) => {
        refreshUpdates()
      }}
    >
      <MainView />
    </window >
  ) as Astal.Window

  // ESC hides
  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.hide()
      return true
    }
    return false
  })
  win.add_controller(key)

  // --- CLICK OUTSIDE CONTROLLER ---
  const click = new Gtk.GestureClick();
  // We set the propagation phase to CAPTURE so the window sees it first
  click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
  click.connect("pressed", (gesture, n_press, x, y) => {
    // Get the child (MainView)
    const child = win.get_child();
    if (child) {
      // Check if the click (x, y) is inside the MainView's allocation
      const alloc = child.get_allocation();

      const isInside = (
        x >= alloc.x &&
        x <= alloc.x + alloc.width &&
        y >= alloc.y &&
        y <= alloc.y + alloc.height
      );

      if (!isInside) {
        win.hide();
        gesture.set_state(Gtk.EventSequenceState.CLAIMED);
      }
    }
  });
  win.add_controller(click);


  return win;

}
