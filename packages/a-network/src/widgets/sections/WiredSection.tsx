import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import type { NetworkWidgetConfig } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { buildSection, createInfoIcon } from "./sectionUtils"

export function createWiredSection(cfg: NetworkWidgetConfig, service: NetworkService) {
  const wiredBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  wiredBody.add_css_class("a-network-section-body")
  const wiredRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  wiredRow.add_css_class("a-network-row")
  const wiredIcon = new Gtk.Image({ pixel_size: 16 })
  const wiredName = new Gtk.Label({ label: "No connection", xalign: 0 })
  wiredName.set_hexpand(true)
  const wiredRight = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  wiredRight.set_halign(Gtk.Align.END)
  const wiredInterface = new Gtk.Label({ label: "--", xalign: 1 })
  wiredInterface.add_css_class("a-network-row-meta")
  const wiredDetailsBtn = new Gtk.Button({ label: "Details" })
  wiredDetailsBtn.add_css_class("a-network-action")
  wiredRight.append(wiredInterface)
  wiredRight.append(wiredDetailsBtn)
  wiredRow.append(wiredIcon)
  wiredRow.append(wiredName)
  wiredRow.append(wiredRight)
  wiredBody.append(wiredRow)
  const wiredDetailsReveal = new Gtk.Revealer({ reveal_child: false })
  const wiredDetailsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  wiredDetailsBox.add_css_class("a-network-details")
  const wiredConnRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const wiredConnLabel = new Gtk.Label({ label: "Connection", xalign: 0 })
  wiredConnLabel.add_css_class("a-network-details-label")
  const wiredConnValue = new Gtk.Label({ label: "--", xalign: 0 })
  wiredConnValue.add_css_class("a-network-details-value")
  wiredConnRow.append(wiredConnLabel)
  wiredConnRow.append(wiredConnValue)
  const wiredIfaceRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const wiredIfaceLabel = new Gtk.Label({ label: "Interface", xalign: 0 })
  wiredIfaceLabel.add_css_class("a-network-details-label")
  const wiredIfaceValue = new Gtk.Label({ label: "--", xalign: 0 })
  wiredIfaceValue.add_css_class("a-network-details-value")
  wiredIfaceRow.append(wiredIfaceLabel)
  wiredIfaceRow.append(wiredIfaceValue)
  const wiredIpRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const wiredIpLabel = new Gtk.Label({ label: "IP address", xalign: 0 })
  wiredIpLabel.add_css_class("a-network-details-label")
  const wiredIpValue = new Gtk.Label({ label: "--", xalign: 0 })
  wiredIpValue.add_css_class("a-network-details-value")
  wiredIpRow.append(wiredIpLabel)
  wiredIpRow.append(wiredIpValue)
  wiredDetailsBox.append(wiredConnRow)
  wiredDetailsBox.append(wiredIfaceRow)
  wiredDetailsBox.append(wiredIpRow)
  wiredDetailsReveal.set_child(wiredDetailsBox)
  wiredBody.append(wiredDetailsReveal)

  const wiredCollapsedInfo = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  wiredCollapsedInfo.add_css_class("a-network-section-collapsed-info")
  const wiredCollapsedIcon = new Gtk.Image({ pixel_size: 16 })
  wiredCollapsedIcon.add_css_class("a-network-section-collapsed-icon")
  const wiredCollapsedLabel = new Gtk.Label({ label: "No connection", xalign: 0 })
  wiredCollapsedLabel.add_css_class("a-network-section-collapsed-text")
  wiredCollapsedInfo.append(wiredCollapsedIcon)
  wiredCollapsedInfo.append(wiredCollapsedLabel)

  const wiredSwitch = new Gtk.Switch()
  wiredSwitch.add_css_class("a-network-switch")
  wiredSwitch.set_hexpand(false)
  wiredSwitch.set_halign(Gtk.Align.END)
  wiredSwitch.set_valign(Gtk.Align.CENTER)
  wiredSwitch.set_vexpand(false)
  wiredSwitch.connect("notify::active", () => {
    service.setWiredEnabled(wiredSwitch.get_active()).catch(err => console.error("a-network wired toggle error", err))
  })
  const wiredRefreshBtn = new Gtk.Button()
  wiredRefreshBtn.add_css_class("a-network-action")
  wiredRefreshBtn.add_css_class("a-network-icon-button")
  const wiredRefreshIcon = new Gtk.Image({ pixel_size: 16 })
  wiredRefreshIcon.set_from_icon_name("view-refresh-symbolic")
  const wiredRefreshSpinner = new Gtk.Spinner()
  wiredRefreshSpinner.set_spinning(false)
  const wiredRefreshStack = new Gtk.Stack()
  wiredRefreshStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  wiredRefreshStack.set_transition_duration(120)
  wiredRefreshStack.add_named(wiredRefreshIcon, "icon")
  wiredRefreshStack.add_named(wiredRefreshSpinner, "spin")
  wiredRefreshStack.set_visible_child_name("icon")
  wiredRefreshBtn.set_child(wiredRefreshStack)
  wiredRefreshBtn.set_valign(Gtk.Align.CENTER)
  wiredRefreshBtn.set_vexpand(false)
  const wiredHeaderRight = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  wiredHeaderRight.set_halign(Gtk.Align.END)
  wiredHeaderRight.append(wiredRefreshBtn)
  wiredHeaderRight.append(wiredSwitch)

  const wiredInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const wiredSection = buildSection("Wired", wiredHeaderRight, wiredBody, false, wiredInfoIcon, true, undefined, wiredCollapsedInfo)

  wiredDetailsBtn.connect("clicked", () => {
    wiredDetailsReveal.set_reveal_child(!wiredDetailsReveal.get_reveal_child())
  })

  let wiredSpinTimer: number | null = null
  let wiredSpinUntil = 0
  const stopWiredSpin = () => {
    wiredRefreshSpinner.stop()
    wiredRefreshStack.set_visible_child_name("icon")
    if (wiredSpinTimer) {
      GLib.source_remove(wiredSpinTimer)
      wiredSpinTimer = null
    }
  }

  const startWiredSpin = (minMs: number) => {
    wiredSpinUntil = Date.now() + minMs
    wiredRefreshStack.set_visible_child_name("spin")
    wiredRefreshSpinner.start()
  }

  wiredRefreshBtn.connect("clicked", () => {
    startWiredSpin(700)
    service.refresh()
      .catch(err => console.error("a-network refresh error", err))
      .finally(() => {
        const remaining = Math.max(0, wiredSpinUntil - Date.now())
        if (remaining > 0) {
          if (wiredSpinTimer) GLib.source_remove(wiredSpinTimer)
          wiredSpinTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
            stopWiredSpin()
            return GLib.SOURCE_REMOVE
          })
          return
        }
        stopWiredSpin()
      })
  })

  createEffect(() => {
    const data = service.data()
    if (!data) {
      wiredSwitch.set_sensitive(false)
      wiredRefreshBtn.set_sensitive(false)
      wiredCollapsedIcon.set_visible(false)
      wiredCollapsedLabel.set_label("Loading...")
      wiredName.set_label("Loading...")
      wiredInterface.set_label("--")
      wiredConnValue.set_label("--")
      wiredIfaceValue.set_label("--")
      wiredIpValue.set_label("--")
      return
    }

    const wired = data.wired
    const wiredConnected = wired?.state === "connected"
    wiredSwitch.set_active(Boolean(wiredConnected))
    wiredSwitch.set_sensitive(Boolean(wired?.device))
    wiredRefreshBtn.set_sensitive(true)
    const showNoInternetByIp = cfg.wiredNoInternetByIp ?? false
    const hasIp = Boolean(wired?.ip)
    const connectivity = data.connectivity
    const noInternetByConnectivity = connectivity !== undefined && connectivity !== "full"
    if (wiredConnected && (noInternetByConnectivity || (showNoInternetByIp && !hasIp))) {
      wiredIcon.set_from_icon_name("network-error-symbolic")
      wiredCollapsedIcon.set_visible(true)
      wiredCollapsedIcon.set_from_icon_name("network-error-symbolic")
    } else if (wiredConnected) {
      wiredIcon.set_from_icon_name("network-wired-symbolic")
      wiredCollapsedIcon.set_visible(true)
      wiredCollapsedIcon.set_from_icon_name("network-wired-symbolic")
    } else {
      wiredIcon.set_from_icon_name("network-wired-disconnected-symbolic")
      wiredCollapsedIcon.set_visible(false)
    }
    const wiredConnName = data.activeWiredConnectionName ?? (wiredConnected ? "Wired" : "No connection")
    wiredName.set_label(wiredConnName)
    wiredInterface.set_label(wired?.device ?? "--")
    wiredConnValue.set_label(wiredConnName)
    wiredIfaceValue.set_label(wired?.device ?? "--")
    wiredIpValue.set_label(wired?.ip ?? "--")
    if (data.activeWiredConnectionName) {
      wiredCollapsedLabel.set_label(data.activeWiredConnectionName)
    } else if (wired?.device) {
      wiredCollapsedLabel.set_label(wired.device)
    } else {
      wiredCollapsedLabel.set_label("No connection")
    }
  }, { immediate: true })

  return {
    controller: wiredSection,
    setTooltip: (text: string) => {
      if (wiredInfoIcon) wiredInfoIcon.set_tooltip_text(text)
    },
  }
}
