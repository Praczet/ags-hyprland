import App from "ags/gtk4/app"
import { Gtk } from "ags/gtk4"
import { power } from "./power"

function PowerButton(label: string, action: () => void) {
  return (
    <button
      class="power-btn"
      onClicked={() => {
        action()
        App.toggleWindow("power-menu")
      }}
    >
      {label}
    </button>
  )
}

export default function PowerMenu(monitor = 0) {
  return (
    <window
      name="power-menu"
      namespace="power-menu"
      monitor={monitor}
      visible={false}
      keymode="on-demand"
      popup
      anchor={Gtk.Align.CENTER}
    >
      <box class="power-menu" vertical spacing={8}>
        {PowerButton("Lock", power.lock)}
        {PowerButton("Logout", power.logout)}
        {PowerButton("Suspend", power.suspend)}
        {PowerButton("Reboot", power.reboot)}
        {PowerButton("Power Off", power.shutdown)}
      </box>
    </window>
  )
}

