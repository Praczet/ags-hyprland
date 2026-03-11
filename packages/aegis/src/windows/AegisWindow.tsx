import { createRoot } from "ags"
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

export type AegisWindowConfig = {
  allowBackgroundRefresh?: boolean
  refreshOnShow?: boolean
}

export function AegisWindow(monitor = 0, cfg: AegisWindowConfig = {}) {
  const contentHost = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
  let currentDispose: (() => void) | null = null
  const refreshConfig = {
    allowBackgroundRefresh: cfg.allowBackgroundRefresh ?? false,
    refreshOnShow: cfg.refreshOnShow ?? true,
  }
  getSysinfoService().setActive("aegis-window", false, refreshConfig)
  const mountContent = (factory: () => Gtk.Widget) => {
    let child = contentHost.get_first_child()
    while (child) {
      contentHost.remove(child)
      child = contentHost.get_first_child()
    }
    if (currentDispose) {
      currentDispose()
      currentDispose = null
    }
    const { widget, dispose } = createRoot((dispose) => {
      const built = factory()
      return { widget: built, dispose }
    })
    currentDispose = dispose
    contentHost.append(widget)
  }
  mountContent(() => AegisWidget())

  const win = (
    <window
      name="aegis"
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
        {contentHost}
      </box>
    </window>
  ) as Astal.Window

  ; (win as any).setAegisView = (view: string) => {
    switch (view) {
      case "aegis-summary":
        mountContent(() => AegisSummaryWidget())
        break
      case "aegis-disk":
        mountContent(() => AegisDiskWidget())
        break
      case "aegis-memory":
        mountContent(() => AegisMemoryWidget())
        break
      case "aegis-network":
        mountContent(() => AegisNetworkWidget())
        break
      case "aegis-battery":
        mountContent(() => AegisBatteryWidget())
        break
      case "aegis-disk-pie":
        mountContent(() => AegisDiskPieWidget())
        break
      case "aegis-memory-pie":
        mountContent(() => AegisMemoryPieWidget())
        break
      case "aegis-cpu-graph":
        mountContent(() => AegisCpuGraphWidget())
        break
      case "aegis":
      default:
        mountContent(() => AegisWidget())
        break
    }
  }

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_ctrl, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.hide()
      return true
    }
    return false
  })
  win.add_controller(key)

  return win
}
