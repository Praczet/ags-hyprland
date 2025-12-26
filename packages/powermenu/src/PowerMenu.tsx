import { Astal, Gdk, Gtk } from "ags/gtk4"
import { power } from "./power"

type ConfirmState = {
  title: string
  message: string
  iconName?: string
  run: () => void
  showMainAfterCancel: boolean
}

export function PowerMenuWindows(monitor = 0) {
  let mainWin: Gtk.Window | null = null
  let confirmWin: Gtk.Window | null = null
  let confirmBtn: Gtk.Button | null = null
  let firstBtn: Gtk.Button | null = null
  let titleLbl: Gtk.Label | null = null
  let msgLbl: Gtk.Label | null = null
  let icon: Gtk.Image | null = null

  let state: ConfirmState = {
    title: "",
    message: "",
    iconName: "",
    run: () => { },
    showMainAfterCancel: true,
  }

  function hideMain() {
    mainWin?.hide()
  }

  function showMain() {
    mainWin?.show()
  }

  function showConfirm(next: ConfirmState) {
    state = next
    titleLbl?.set_label(state.title)
    msgLbl?.set_label(state.message)
    icon?.set_from_icon_name(state.iconName || "dialog-warning-symbolic")
    hideMain()
    confirmWin?.show()
    // focus "Confirm" so Enter feels natural
    confirmBtn?.grab_focus()
  }

  function cancelConfirm() {
    confirmWin?.hide()
    if (state.showMainAfterCancel) showMain()
  }

  function confirmYes() {
    confirmWin?.hide()
    state.run()
  }

  // ----- Buttons -----------------------------------------------------------

  function SafeButton(label: string, action: () => void) {
    return (
      <button
        $={(b: Gtk.Button) => (firstBtn = b)}
        class="power-btn"
        onClicked={(btn) => {
          const win = btn.get_root() as Gtk.Window | null
          win?.hide()
          action()
        }}
      >
        <box
          hexpand={true}
          halign={Gtk.Align.CENTER}
          widthRequest={120}
        >
          <image icon-name="system-lock-screen-symbolic" pixelSize={32} />
          <label
            margin_start={16}
            label={label} />
        </box>
      </button>
    )
  }

  function ConfirmButton(label: string, title: string, message: string, action: () => void, iconName: string) {
    return (
      <button
        class="power-btn"
        onClicked={() =>
          showConfirm({
            title,
            message,
            run: action,
            showMainAfterCancel: true,
            iconName,
          })
        }
      >
        <box
          hexpand={true}
          halign={Gtk.Align.CENTER}
          widthRequest={120}
        >
          <image iconName={iconName} pixelSize={32} />
          <label
            class="power-btn-label"
            margin_start={16}
            label={label}
          />
        </box>
      </button>
    )
  }

  // ----- Windows -----------------------------------------------------------

  const main = (
    <window
      name="powermenu"
      class="powermenu-window"
      namespace="adart-powermenu"
      monitor={monitor}
      visible={false}
      keymode={Astal.Keymode.EXCLUSIVE}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT |
        Astal.WindowAnchor.BOTTOM
      }
      $={(w: Gtk.Window) => {
        mainWin = w
        // 1) ESC closes
        const key = new Gtk.EventControllerKey()
        key.connect("key-pressed", (_c, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            w.hide()
            return true
          }
          return false
        })
        w.add_controller(key)

        const click = new Gtk.GestureClick()
        click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        click.connect("pressed", (gesture, _nPress, x, y) => {
          const child = w.get_child();
          if (child) {
            const alloc = child.get_allocation();
            const isInside = (
              x >= alloc.x &&
              x <= alloc.x + alloc.width &&
              y >= alloc.y &&
              y <= alloc.y + alloc.height
            );

            if (!isInside) {
              w.hide();
              gesture.set_state(Gtk.EventSequenceState.CLAIMED);
            }
          }
        })
        w.add_controller(click)
      }}
      onShow={() => firstBtn?.grab_focus()}
    >
      <box class="power-menu"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}>
        {SafeButton("Lock", power.lock)}
        {
          ConfirmButton(
            "Logout",
            "Logout?",
            "You will be signed out.",
            power.logout,
            "system-log-out-symbolic"
          )
        }
        {ConfirmButton("Suspend", "Suspend?", "Your session will be suspended.", power.suspend, "media-playback-pause-symbolic")}
        {ConfirmButton("Reboot", "Reboot?", "The system will restart.", power.reboot, "system-reboot-symbolic")}
        {ConfirmButton("Power Off", "Power off?", "The system will shut down.", power.shutdown, "system-shutdown-symbolic")}
      </box>
    </window>
  ) as unknown as Gtk.Window

  const confirm = (
    <window
      name="powermenu-confirm"
      namespace="adart-powermenu"
      class="powermenu-confirm-window"
      monitor={monitor}
      visible={false}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT |
        Astal.WindowAnchor.BOTTOM
      }
      $={(w: Gtk.Window) => {
        confirmWin = w

        // Enter = confirm, Escape = cancel
        const key = new Gtk.EventControllerKey()
        key.connect("key-pressed", (_c, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            cancelConfirm()
            return true
          }
          if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
            confirmYes()
            return true
          }
          return false
        })
        w.add_controller(key)

        const click = new Gtk.GestureClick()
        click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        click.connect("pressed", (gesture, _nPress, x, y) => {
          const child = w.get_child();
          console.log(child);
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
              w.hide();
              gesture.set_state(Gtk.EventSequenceState.CLAIMED);
            }
          }
        })
        w.add_controller(click)
      }}
    >
      <box class="power-confirm"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={20}
        halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <box
          orientation={Gtk.Orientation.HORIZONTAL}
          spacing={10}
          halign={Gtk.Align.FILL}
          hexpand={true}
        >
          <image
            class="power-confirm-icon"
            pixelSize={64}
            $={(l: Gtk.Image) => (icon = l)}
            halign={Gtk.Align.START}
          />
          <label
            class="power-confirm-title"
            $={(l: Gtk.Label) => (titleLbl = l)}
            halign={Gtk.Align.FILL}
            hexpand={true}
            label={state.title} />
        </box>
        <label
          class="power-confirm-msg"
          $={(l: Gtk.Label) => (msgLbl = l)}
          label={state.message}
          wrap={true}
          maxWidthChars={34} />
        <box
          class="power-confirm-actions"
          spacing={8}
          halign={Gtk.Align.FILL}>
          <button
            class="power-btn"
            onClicked={cancelConfirm}
            halign={Gtk.Align.FILL}
            hexpand={true}
          >Cancel</button>
          <button
            class="power-btn power-btn-confirm"
            $={(b: Gtk.Button) => (confirmBtn = b)}
            onClicked={confirmYes}
            halign={Gtk.Align.FILL}
            hexpand={true}
          >
            Confirm
          </button>
        </box>
        <label class="power-confirm-hint" label="Enter = Confirm · Esc = Cancel" />
      </box>
    </window>
  ) as unknown as Gtk.Window

  return { main, confirm }
}

