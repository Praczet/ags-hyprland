import { createState } from "ags"
import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import { AegisWidget } from "../widgets/AegisWidget"
import { AegisSummaryWidget } from "../widgets/AegisSummaryWidget"
import { AegisDiskWidget } from "../widgets/AegisDiskWidget"
import { AegisMemoryWidget } from "../widgets/AegisMemoryWidget"
import { AegisMemoryPieWidget } from "../widgets/MemoryPieWidget"
import { AegisNetworkWidget } from "../widgets/AegisNetworkWidget"
import { AegisBatteryWidget } from "../widgets/AegisBatteryWidget"
import { AegisDiskPieWidget } from "../widgets/DiskPieWidget"
import { AegisCpuGraphWidget } from "../widgets/AegisCpuGraphWidget"
import { getSysinfoService } from "../services/sysinfo"
import type { AegisViewId } from "../types"

export const AEGIS_WINDOW_NAME = "aegis"

export type AegisWindowConfig = {
  allowBackgroundRefresh?: boolean
  refreshOnShow?: boolean
}

export type AegisWindowHandle = Astal.Window & {
  openWindow(): void
  closeWindow(): void
  setAegisView(view: AegisViewId): void
}

export function AegisWindow(monitor = 0, cfg: AegisWindowConfig = {}) {
  const [currentView, setCurrentView] = createState<AegisViewId>("aegis")
  const refreshConfig = {
    allowBackgroundRefresh: cfg.allowBackgroundRefresh ?? false,
    refreshOnShow: cfg.refreshOnShow ?? true,
  }
  getSysinfoService().setActive("aegis-window", false, refreshConfig)

  const viewFactories: Record<AegisViewId, () => Gtk.Widget> = {
    aegis: () => AegisWidget(),
    "aegis-summary": () => AegisSummaryWidget(),
    "aegis-disk": () => AegisDiskWidget(),
    "aegis-memory": () => AegisMemoryWidget(),
    "aegis-network": () => AegisNetworkWidget(),
    "aegis-battery": () => AegisBatteryWidget(),
    "aegis-disk-pie": () => AegisDiskPieWidget(),
    "aegis-memory-pie": () => AegisMemoryPieWidget(),
    "aegis-cpu-graph": () => AegisCpuGraphWidget(),
  }

  const win = (
    <window
      name={AEGIS_WINDOW_NAME}
      namespace="adart-aegis"
      class="aegis-window"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      onShow={() => {
        getSysinfoService().setActive("aegis-window", true, refreshConfig)
      }}
      onHide={() => {
        getSysinfoService().setActive("aegis-window", false)
      }}
    >
      <box
        class="aegis-window-inner"
        orientation={Gtk.Orientation.VERTICAL}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      >
        <box class="aegis-window-header" orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
          <label class="aegis-window-title" label="Aegis" xalign={0} />
        </box>
        <stack
          visible_child_name={currentView.as(view => view)}
          transition_type={Gtk.StackTransitionType.CROSSFADE}
          $={(self: Gtk.Stack) => {
            for (const [view, factory] of Object.entries(viewFactories) as Array<[AegisViewId, () => Gtk.Widget]>) {
              self.add_named(factory(), view)
            }
          }}
        />
      </box>
    </window>
  ) as AegisWindowHandle

  win.setAegisView = (view: AegisViewId) => {
    setCurrentView(view)
  }

  win.openWindow = () => {
    win.show()
  }

  win.closeWindow = () => {
    win.hide()
  }

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_ctrl, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.closeWindow()
      return true
    }
    return false
  })
  win.add_controller(key)

  return win
}
