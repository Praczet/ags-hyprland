import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import type { BluetoothDevice, NetworkWidgetConfig } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { buildSection, clearBox, createInfoIcon } from "./sectionUtils"

function formatDeviceMeta(device: BluetoothDevice) {
  const parts: string[] = []
  if (device.connected) {
    parts.push("Connected")
  } else if (device.paired) {
    parts.push("Not connected")
  }
  if (device.trusted) parts.push("Trusted")
  if (typeof device.battery === "number") parts.push(`Battery ${device.battery}%`)
  return parts.join(" · ") || "--"
}

function buildDeviceRow(
  device: BluetoothDevice,
  opts: {
    onConnect?: () => void
    onDisconnect?: () => void
    onPair?: () => void
    onForget?: () => void
    muted?: boolean
  },
) {
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("a-network-row")
  if (opts.muted) row.add_css_class("a-network-muted")
  const icon = new Gtk.Image({ pixel_size: 16 })
  icon.set_from_icon_name("bluetooth-symbolic")
  const label = new Gtk.Label({ label: device.name ?? device.id, xalign: 0 })
  label.set_hexpand(true)

  const right = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  right.set_halign(Gtk.Align.END)
  const meta = new Gtk.Label({ label: formatDeviceMeta(device), xalign: 1 })
  meta.add_css_class("a-network-row-meta")

  right.append(meta)

  if (opts.onPair) {
    const pairBtn = new Gtk.Button({ label: "Pair" })
    pairBtn.add_css_class("a-network-action")
    pairBtn.connect("clicked", opts.onPair)
    right.append(pairBtn)
  }

  if (opts.onConnect || opts.onDisconnect) {
    const actionBtn = new Gtk.Button({ label: device.connected ? "Disconnect" : "Connect" })
    actionBtn.add_css_class("a-network-action")
    actionBtn.connect("clicked", () => {
      if (device.connected) {
        opts.onDisconnect?.()
      } else {
        opts.onConnect?.()
      }
    })
    right.append(actionBtn)
  }

  if (opts.onForget) {
    const forgetBtn = new Gtk.Button({ label: "Forget" })
    forgetBtn.add_css_class("a-network-action")
    forgetBtn.connect("clicked", opts.onForget)
    right.append(forgetBtn)
  }

  row.append(icon)
  row.append(label)
  row.append(right)
  return row
}

export function createBluetoothSection(cfg: NetworkWidgetConfig, service: NetworkService) {
  const body = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  body.add_css_class("a-network-section-body")

  const statusRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  statusRow.add_css_class("a-network-row")
  const statusIcon = new Gtk.Image({ pixel_size: 16 })
  const statusLabel = new Gtk.Label({ label: "Bluetooth unavailable", xalign: 0 })
  statusLabel.set_hexpand(true)
  statusRow.append(statusIcon)
  statusRow.append(statusLabel)
  body.append(statusRow)

  const pairedTitle = new Gtk.Label({ label: "Paired devices", xalign: 0 })
  pairedTitle.add_css_class("a-network-subtitle")
  const pairedList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  body.append(pairedTitle)
  body.append(pairedList)

  const availableTitle = new Gtk.Label({ label: "Available devices", xalign: 0 })
  availableTitle.add_css_class("a-network-subtitle")
  const availableList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const availableScroll = new Gtk.ScrolledWindow()
  availableScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  availableScroll.set_propagate_natural_height(true)
  availableScroll.set_min_content_width(500)
  availableScroll.set_max_content_height(180)
  availableScroll.set_child(availableList)
  body.append(availableTitle)
  body.append(availableScroll)

  const collapsedInfo = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  collapsedInfo.add_css_class("a-network-section-collapsed-info")
  const collapsedIcon = new Gtk.Image({ pixel_size: 16 })
  collapsedIcon.add_css_class("a-network-section-collapsed-icon")
  const collapsedLabel = new Gtk.Label({ label: "Bluetooth unavailable", xalign: 0 })
  collapsedLabel.add_css_class("a-network-section-collapsed-text")
  collapsedInfo.append(collapsedIcon)
  collapsedInfo.append(collapsedLabel)

  const powerSwitch = new Gtk.Switch()
  powerSwitch.add_css_class("a-network-switch")
  powerSwitch.set_hexpand(false)
  powerSwitch.set_halign(Gtk.Align.END)
  powerSwitch.set_valign(Gtk.Align.CENTER)
  powerSwitch.set_vexpand(false)
  powerSwitch.connect("notify::active", () => {
    service.setBluetoothEnabled(powerSwitch.get_active()).catch(err => console.error("a-network bluetooth toggle error", err))
  })

  const scanBtn = new Gtk.Button()
  scanBtn.add_css_class("a-network-action")
  scanBtn.add_css_class("a-network-icon-button")
  const scanIcon = new Gtk.Image({ pixel_size: 16 })
  scanIcon.set_from_icon_name("view-refresh-symbolic")
  const scanSpinner = new Gtk.Spinner()
  scanSpinner.set_spinning(false)
  const scanStack = new Gtk.Stack()
  scanStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  scanStack.set_transition_duration(120)
  scanStack.add_named(scanIcon, "icon")
  scanStack.add_named(scanSpinner, "spin")
  scanStack.set_visible_child_name("icon")
  scanBtn.set_child(scanStack)
  scanBtn.set_valign(Gtk.Align.CENTER)
  scanBtn.set_vexpand(false)

  const headerRight = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  headerRight.set_halign(Gtk.Align.END)
  headerRight.append(scanBtn)
  headerRight.append(powerSwitch)

  const infoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const section = buildSection("Bluetooth", headerRight, body, false, infoIcon, true, undefined, collapsedInfo)

  scanBtn.connect("clicked", () => {
    service.scanBluetooth().catch(err => console.error("a-network bluetooth scan error", err))
  })

  createEffect(() => {
    const data = service.data()
    if (!data) {
      powerSwitch.set_sensitive(false)
      scanBtn.set_sensitive(false)
      statusIcon.set_visible(false)
      statusLabel.set_label("Loading...")
      collapsedIcon.set_visible(false)
      collapsedLabel.set_label("Loading...")
      clearBox(pairedList)
      clearBox(availableList)
      return
    }

    const bluetooth = data.bluetooth
    if (!bluetooth) {
      powerSwitch.set_sensitive(false)
      scanBtn.set_sensitive(false)
      statusIcon.set_visible(false)
      statusLabel.set_label("Bluetooth unavailable")
      collapsedIcon.set_visible(false)
      collapsedLabel.set_label("Bluetooth unavailable")
      clearBox(pairedList)
      clearBox(availableList)
      return
    }

    const powered = Boolean(bluetooth.powered)
    powerSwitch.set_sensitive(true)
    powerSwitch.set_active(powered)
    scanBtn.set_sensitive(powered)
    statusIcon.set_visible(true)
    statusIcon.set_from_icon_name(powered ? "bluetooth-symbolic" : "bluetooth-disabled-symbolic")
    statusLabel.set_label(powered ? "Bluetooth on" : "Bluetooth off")
    collapsedIcon.set_visible(true)
    collapsedIcon.set_from_icon_name(powered ? "bluetooth-symbolic" : "bluetooth-disabled-symbolic")
    const connectedCount = bluetooth.paired.filter(device => device.connected).length
    const connectedLabel = connectedCount > 0 ? `${connectedCount} connected` : "no device connected"
    collapsedLabel.set_label(`${powered ? "On" : "Off"} · ${connectedLabel}`)

    clearBox(pairedList)
    if (!bluetooth.paired.length) {
      const empty = new Gtk.Label({ label: "No paired devices", xalign: 0 })
      empty.add_css_class("a-network-muted")
      pairedList.append(empty)
    } else {
      for (const device of bluetooth.paired) {
        pairedList.append(buildDeviceRow(device, {
          onConnect: () => service.connectBluetooth(device.id).catch(err => console.error("a-network bluetooth connect error", err)),
          onDisconnect: () => service.disconnectBluetooth(device.id).catch(err => console.error("a-network bluetooth disconnect error", err)),
          onForget: () => service.removeBluetooth(device.id).catch(err => console.error("a-network bluetooth remove error", err)),
          muted: !device.connected,
        }))
      }
    }

    clearBox(availableList)
    if (!bluetooth.devices.length) {
      const empty = new Gtk.Label({ label: "No available devices", xalign: 0 })
      empty.add_css_class("a-network-muted")
      availableList.append(empty)
    } else {
      for (const device of bluetooth.devices) {
        availableList.append(buildDeviceRow(device, {
          onPair: () => service.pairBluetooth(device.id).catch(err => console.error("a-network bluetooth pair error", err)),
        }))
      }
    }
  }, { immediate: true })

  createEffect(() => {
    const isScanning = service.bluetoothScanning()
    if (isScanning) {
      scanStack.set_visible_child_name("spin")
      scanSpinner.start()
    } else {
      scanSpinner.stop()
      scanStack.set_visible_child_name("icon")
    }
  }, { immediate: true })

  return {
    controller: section,
    setTooltip: (text: string) => {
      if (infoIcon) infoIcon.set_tooltip_text(text)
    },
  }
}
