import { Astal, Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { power } from "./power"

type ConfirmState = {
  title: string
  message: string
  run: () => void
  showMainAfterCancel: boolean
}

export function PowerMenuWindows(monitor = 0) {
  let mainWin: Gtk.Window | null = null
  let confirmWin: Gtk.Window | null = null
  let confirmBtn: Gtk.Button | null = null
  let firstBtn: Gtk.Button | null = null

  let state: ConfirmState = {
    title: "",
    message: "",
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
        {label}
      </button>
    )
  }

  function ConfirmButton(label: string, title: string, message: string, action: () => void) {
    return (
      <button
        class="power-btn"
        onClicked={() =>
          showConfirm({
            title,
            message,
            run: action,
            showMainAfterCancel: true,
          })
        }
      >
        {label}
      </button>
    )
  }

  // ----- Windows -----------------------------------------------------------

  const main = (
    <window
      name="powermenu"
      namespace="adart-powermenu"
      monitor={monitor}
      visible={false}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT
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

          // 2) Clicking outside (i.e., on the window background) closes
          // This works best if the window covers the screen area for that anchor.
          const click = new Gtk.GestureClick()
          click.connect("pressed", (_g, _nPress, x, y) => {
            const picked = w.pick(x, y, Gtk.PickFlags.DEFAULT)

            // If click didn't hit a child widget (or you hit the window itself),
            // treat it as "outside" and close.
            if (!picked || picked === w) {
              w.hide()
            }
          })
          w.add_controller(click)

          w.connect("notify::is-active", () => {
              // delay a tiny bit to avoid races right after present()
              GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                if (w.visible && !w.is_active) w.hide()
                return GLib.SOURCE_REMOVE
              })
            })
          // // Optional: also close when focus leaves (very “popup” feeling)
          // const focus = new Gtk.EventControllerFocus()
          // focus.connect("leave", () => {
          //   if (w.visible) w.hide()
          // })
          // w.add_controller(focus)
        }}
        onShow={() => firstBtn?.grab_focus()}
    >
      <box class="power-menu"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        halign={Gtk.Align.CENTER} 
        valign={Gtk.Align.CENTER}>
        { SafeButton("Lock", power.lock)}
        { ConfirmButton("Logout",    "Logout?",    "You will be signed out.",         power.logout   )}
        { ConfirmButton("Suspend",   "Suspend?",   "Your session will be suspended.", power.suspend  )}
        { ConfirmButton("Reboot",    "Reboot?",    "The system will restart.",        power.reboot   )}
        { ConfirmButton("Power Off", "Power off?", "The system will shut down.",      power.shutdown )}
      </box>
    </window>
  ) as unknown as Gtk.Window

  const confirm = (
    <window
      name="powermenu-confirm"
      namespace="adart-powermenu"
      monitor={monitor}
      visible={false}
      keymode={Astal.Keymode.ON_DEMAND}
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
      }}
    >
      <box class="power-confirm"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={10}
        halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <label class="power-confirm-title" label={state.title} />
        <label class="power-confirm-msg" label={state.message} wrap={true} maxWidthChars={34} />
        <box class="power-confirm-actions" spacing={8} halign={Gtk.Align.CENTER}>
          <button class="power-btn" onClicked={cancelConfirm}>Cancel</button>
          <button
            class="power-btn power-btn-confirm"
            $={(b: Gtk.Button) => (confirmBtn = b)}
            onClicked={confirmYes}
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

