import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Pango from "gi://Pango"
import type { ConnectionDetails, NetworkWidgetConfig, SavedConnection, WifiNetwork } from "../../types"
import type { NetworkService } from "../../services/networkService"
import { buildSection, clearBox, createInfoIcon } from "./sectionUtils"

function formatSignal(signal?: number) {
  if (!Number.isFinite(Number(signal))) return "--"
  return `${Math.round(Number(signal))}%`
}

function signalIcon(signal?: number) {
  if (!Number.isFinite(Number(signal))) return "network-wireless-signal-none-symbolic"
  const value = Number(signal)
  if (value >= 80) return "network-wireless-signal-excellent-symbolic"
  if (value >= 60) return "network-wireless-signal-good-symbolic"
  if (value >= 40) return "network-wireless-signal-ok-symbolic"
  if (value >= 20) return "network-wireless-signal-weak-symbolic"
  return "network-wireless-signal-none-symbolic"
}

function isSecure(security?: string) {
  if (!security) return false
  const norm = security.toLowerCase()
  return norm !== "--" && norm !== "none" && norm !== "open"
}

function formatLastConnected(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return "--"

  const d = new Date(ts * 1000)

  const pad2 = (n: number) => String(n).padStart(2, "0")
  const pad3 = (n: number) => String(n).padStart(3, "0")

  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())

  const HH = pad2(d.getHours())
  const MM = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  const sss = pad3(d.getMilliseconds())

  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${ss}`
}

function buildWifiQr(ssid: string, password: string) {
  if (!GLib.find_program_in_path("qrencode")) return null
  const tmpDir = GLib.get_tmp_dir()
  const safe = ssid.replace(/[^a-zA-Z0-9_-]/g, "_")
  const path = `${tmpDir}/a-network-${safe}-${Date.now()}.png`
  const payload = `WIFI:T:WPA;S:${ssid};P:${password};;`
  const cmd = `qrencode -s 8 -m 1 -o "${path}" "${payload.replace(/"/g, "\\\"")}"`
  const out = GLib.spawn_command_line_sync(cmd)
  if (!out?.[0]) return null
  return path
}

function createInfoColumn() {
  const infoCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  infoCol.add_css_class("a-network-details-col")

  const makeRow = (labelText: string) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
    const label = new Gtk.Label({ label: labelText })
    label.add_css_class("a-network-details-label")
    const value = new Gtk.Label({ label: "--" })
    value.add_css_class("a-network-details-value")
    row.append(label)
    row.append(value)
    return { row, value }
  }

  const ssidRow = makeRow("SSID")
  const securityRow = makeRow("Encryption")
  const lastRow = makeRow("Last connected")
  const signalRow = makeRow("Signal")

  infoCol.append(ssidRow.row)
  infoCol.append(securityRow.row)
  infoCol.append(lastRow.row)
  infoCol.append(signalRow.row)

  return {
    box: infoCol,
    setInfo: (info: { ssid?: string; security?: string; lastConnected?: number; signal?: number }) => {
      ssidRow.value.set_label(info.ssid ?? "--")
      securityRow.value.set_label(info.security ?? "--")
      lastRow.value.set_label(info.lastConnected ? formatLastConnected(info.lastConnected) : "--")
      signalRow.value.set_label(info.signal !== undefined ? formatSignal(info.signal) : "--")
    },
  }
}

type SavedRowState = {
  expanded: boolean
  passwordVisible: boolean
  passwordValueCache: string | null
  passwordFetched: boolean
  qrPath: string | null
}

type WifiRowState = {
  expanded: boolean
  passwordText: string
  passwordVisible: boolean
  passwordValueCache: string | null
  passwordFetched: boolean
  qrPath: string | null
  lastConnected: number | null
}

type WifiRowEntry = {
  container: Gtk.Box
  update: (iface: WifiNetwork, isKnown: boolean, savedName?: string) => void
}

type SavedRowEntry = {
  container: Gtk.Box
  update: (saved: SavedConnection) => void
  setMuted: (muted: boolean) => void
}

function buildSavedRow(
  saved: SavedConnection,
  onActivate: (name: string, active: boolean) => void,
  onForget: (name: string) => void,
  fetchDetails: (name: string) => Promise<ConnectionDetails>,
  fetchPassword: (name: string) => Promise<string | null>,
  allowPlainText: boolean,
  allowQr: boolean,
  state: SavedRowState,
): SavedRowEntry {
  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("a-network-row")
  const label = new Gtk.Label({ label: saved.name, xalign: 0 })
  label.set_hexpand(true)
  if (saved.active) label.add_css_class("a-network-active")
  const meta = new Gtk.Label({ label: saved.device ?? "--", xalign: 1 })
  meta.add_css_class("a-network-row-meta")
  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  actions.set_halign(Gtk.Align.END)
  const connectBtn = new Gtk.Button({ label: saved.active ? "Disconnect" : "Connect" })
  connectBtn.add_css_class("a-network-action")
  const detailsBtn = new Gtk.Button({ label: "Details" })
  detailsBtn.add_css_class("a-network-action")
  const forgetBtn = new Gtk.Button({ label: "Forget" })
  forgetBtn.add_css_class("a-network-action")
  actions.append(connectBtn)
  actions.append(detailsBtn)
  actions.append(forgetBtn)
  row.append(label)
  row.append(meta)
  row.append(actions)

  const detailsReveal = new Gtk.Revealer({ reveal_child: false })
  const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  detailsBox.add_css_class("a-network-details")
  detailsBox.set_hexpand(true)
  detailsBox.set_halign(Gtk.Align.FILL)
  const infoCol = createInfoColumn()
  infoCol.box.set_hexpand(true)
  const passwordCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  passwordCol.add_css_class("a-network-details-col")
  const passwordRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const passwordLabel = new Gtk.Label({ label: "Password", xalign: 0 })
  passwordLabel.add_css_class("a-network-details-label")
  const toggleLabel = new Gtk.Label({ label: "Show", xalign: 0 })
  toggleLabel.add_css_class("a-network-details-label")
  const passwordToggle = new Gtk.Switch()
  passwordToggle.add_css_class("a-network-switch")
  passwordRow.append(passwordLabel)
  passwordRow.append(toggleLabel)
  passwordRow.append(passwordToggle)
  const passwordValue = new Gtk.Label({ label: "Hidden", xalign: 0.5 })
  passwordValue.add_css_class("a-network-details-value")
  passwordValue.set_halign(Gtk.Align.CENTER)
  passwordValue.set_hexpand(true)
  passwordValue.set_width_chars(24)
  passwordValue.set_ellipsize(Pango.EllipsizeMode.END)
  passwordValue.set_max_width_chars(24)
  const qr = new Gtk.Picture()
  qr.set_visible(true)
  qr.set_size_request(128, -1)
  qr.set_can_shrink(true)
  qr.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  qr.set_halign(Gtk.Align.CENTER)
  qr.set_opacity(0)
  passwordCol.append(passwordRow)
  passwordCol.append(passwordValue)
  const qrSlot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  qrSlot.set_halign(Gtk.Align.CENTER)
  qrSlot.set_size_request(128, -1)
  qrSlot.append(qr)
  passwordCol.append(qrSlot)
  detailsBox.append(infoCol.box)
  detailsBox.append(passwordCol)
  detailsReveal.set_child(detailsBox)

  let detailsLoaded = false
  let loading = false

  let isMuted = false
  const applyMuted = () => {
    const expanded = detailsReveal.get_reveal_child()
    if (isMuted && !expanded) {
      container.add_css_class("a-network-muted")
    } else {
      container.remove_css_class("a-network-muted")
    }
  }

  const updatePasswordDisplay = () => {
    if (!allowPlainText) {
      passwordToggle.set_sensitive(false)
      passwordValue.set_label("Disabled")
      qr.set_opacity(0)
      return
    }
    if (!state.passwordVisible) {
      passwordValue.set_label("Hidden")
      qr.set_opacity(0)
      return
    }
    if (state.passwordFetched) {
      passwordValue.set_label(state.passwordValueCache || "Unavailable")
      if (state.qrPath && state.passwordValueCache) {
        qr.set_filename(state.qrPath)
        qr.set_opacity(1)
      } else {
        qr.set_opacity(0)
      }
    }
  }

  const loadDetails = async () => {
    if (loading) return
    loading = true
    try {
      const details = await fetchDetails(saved.name)
      infoCol.setInfo({
        ssid: details.ssid ?? saved.ssid ?? saved.name,
        security: details.security ?? "--",
        lastConnected: details.lastConnected,
        signal: undefined,
      })
      detailsLoaded = true
    } catch (err) {
      console.error("a-network details error", err)
    } finally {
      loading = false
    }
  }

  passwordToggle.connect("notify::active", async () => {
    if (!passwordToggle.get_active()) {
      state.passwordVisible = false
      updatePasswordDisplay()
      return
    }
    state.passwordVisible = true
    if (state.passwordFetched) {
      updatePasswordDisplay()
      return
    }
    passwordValue.set_label("Loading...")
    try {
      const pass = await fetchPassword(saved.name)
      state.passwordValueCache = pass
      state.passwordFetched = true
      if (pass && state.qrPath === null && allowQr) {
        state.qrPath = buildWifiQr(saved.name, pass)
      }
      updatePasswordDisplay()
    } catch (err) {
      console.error("a-network password error", err)
      state.passwordFetched = true
      passwordValue.set_label("Unavailable")
      qr.set_opacity(0)
    }
  })

  detailsBtn.connect("clicked", () => {
    state.expanded = !detailsReveal.get_reveal_child()
    detailsReveal.set_reveal_child(state.expanded)
    applyMuted()
    if (state.expanded && !detailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  })

  connectBtn.connect("clicked", () => {
    onActivate(saved.name, Boolean(saved.active))
  })

  forgetBtn.connect("clicked", () => onForget(saved.name))

  const update = (next: SavedConnection) => {
    const active = Boolean(next.active)
    connectBtn.set_label(active ? "Disconnect" : "Connect")
    label.set_label(next.name)
    meta.set_label(next.device ?? "--")
    if (active) {
      label.add_css_class("a-network-active")
    } else {
      label.remove_css_class("a-network-active")
    }
  }


  const setMuted = (muted: boolean) => {
    isMuted = muted
    applyMuted()
  }

  container.append(row)
  container.append(detailsReveal)

  update(saved)
  updatePasswordDisplay()
  return { container, update, setMuted }
}

function buildWifiRow(
  iface: WifiNetwork,
  isKnown: boolean,
  savedName: string | undefined,
  onConnect: (ssid: string, known: boolean, savedName?: string, password?: string) => void,
  fetchDetails: (name: string) => Promise<ConnectionDetails>,
  fetchPassword: (name: string) => Promise<string | null>,
  allowPlainText: boolean,
  allowQr: boolean,
  state: WifiRowState,
): WifiRowEntry {
  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("a-network-row")
  const icon = new Gtk.Image({ pixel_size: 16 })
  const label = new Gtk.Label({ label: iface.ssid, xalign: 0 })
  label.set_hexpand(true)
  const meta = new Gtk.Label({ label: `${formatSignal(iface.signal)} ${iface.security ?? "--"}`, xalign: 1 })
  meta.add_css_class("a-network-row-meta")
  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  actions.set_halign(Gtk.Align.END)
  const connectBtn = new Gtk.Button({ label: isKnown ? "Connect" : "Join" })
  connectBtn.add_css_class("a-network-action")
  const detailsBtn = new Gtk.Button({ label: "Details" })
  detailsBtn.add_css_class("a-network-action")
  actions.append(detailsBtn)
  actions.append(connectBtn)
  row.append(icon)
  row.append(label)
  row.append(meta)
  row.append(actions)

  const detailsReveal = new Gtk.Revealer({ reveal_child: false })
  const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  detailsBox.add_css_class("a-network-details")
  detailsBox.set_hexpand(true)
  detailsBox.set_halign(Gtk.Align.FILL)
  const infoCol = createInfoColumn()
  infoCol.box.set_hexpand(true)
  const rightCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  rightCol.add_css_class("a-network-details-col")
  const savedRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const savedLabel = new Gtk.Label({ label: "Saved", xalign: 0 })
  savedLabel.add_css_class("a-network-details-label")
  const savedToggleLabel = new Gtk.Label({ label: "Show", xalign: 0 })
  savedToggleLabel.add_css_class("a-network-details-label")
  const savedToggle = new Gtk.Switch()
  savedToggle.add_css_class("a-network-switch")
  savedRow.append(savedLabel)
  savedRow.append(savedToggleLabel)
  savedRow.append(savedToggle)
  const savedValue = new Gtk.Label({ label: "Hidden", xalign: 0.5 })
  savedValue.add_css_class("a-network-details-value")
  savedValue.set_halign(Gtk.Align.CENTER)
  savedValue.set_hexpand(true)
  savedValue.set_width_chars(24)
  savedValue.set_ellipsize(Pango.EllipsizeMode.END)
  savedValue.set_max_width_chars(24)
  const qr = new Gtk.Picture()
  qr.set_visible(true)
  qr.set_size_request(128, -1)
  qr.set_can_shrink(true)
  qr.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  qr.set_halign(Gtk.Align.CENTER)
  qr.set_opacity(0)
  rightCol.append(savedRow)
  rightCol.append(savedValue)
  const qrSlot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  qrSlot.set_halign(Gtk.Align.CENTER)
  qrSlot.set_size_request(128, -1)
  qrSlot.append(qr)
  rightCol.append(qrSlot)
  detailsBox.append(infoCol.box)
  detailsBox.append(rightCol)
  detailsReveal.set_child(detailsBox)

  let detailsLoaded = false
  let loading = false
  let currentSsid = iface.ssid
  let currentSecurity = iface.security
  let currentSignal = iface.signal
  let currentIsKnown = isKnown
  let currentSavedName = savedName

  let isMuted = false
  const applyMuted = () => {
    const expanded = detailsReveal.get_reveal_child()
    if (isMuted && !expanded) {
      container.add_css_class("a-network-muted")
    } else {
      container.remove_css_class("a-network-muted")
    }
  }

  const updatePasswordDisplay = () => {
    if (!allowPlainText) {
      savedToggle.set_sensitive(false)
      savedValue.set_label("Disabled")
      qr.set_opacity(0)
      return
    }
    if (!state.passwordVisible) {
      savedValue.set_label("Hidden")
      qr.set_opacity(0)
      return
    }
    if (state.passwordFetched) {
      savedValue.set_label(state.passwordValueCache || "Unavailable")
      if (state.qrPath && state.passwordValueCache) {
        qr.set_filename(state.qrPath)
        qr.set_opacity(1)
      } else {
        qr.set_opacity(0)
      }
    }
  }

  const loadDetails = async () => {
    if (loading) return
    loading = true
    try {
      if (currentIsKnown && currentSavedName) {
        const details = await fetchDetails(currentSavedName)
        state.lastConnected = details.lastConnected ?? null
        infoCol.setInfo({
          ssid: details.ssid ?? currentSsid,
          security: details.security ?? "--",
          lastConnected: details.lastConnected,
          signal: currentSignal,
        })
      } else {
        infoCol.setInfo({
          ssid: currentSsid,
          security: currentSecurity ?? "--",
          lastConnected: undefined,
          signal: currentSignal,
        })
      }
      detailsLoaded = true
    } catch (err) {
      console.error("a-network details error", err)
    } finally {
      loading = false
    }
  }

  const applyFlags = () => {
    if (currentIsKnown) {
      label.add_css_class("a-network-active")
    } else {
      label.remove_css_class("a-network-active")
    }
    connectBtn.set_label(currentIsKnown ? "Connect" : "Join")
  }

  savedToggle.connect("notify::active", async () => {
    if (!savedToggle.get_active()) {
      state.passwordVisible = false
      updatePasswordDisplay()
      return
    }
    state.passwordVisible = true
    if (state.passwordFetched) {
      updatePasswordDisplay()
      return
    }
    savedValue.set_label("Loading...")
    try {
      const pass = currentSavedName ? await fetchPassword(currentSavedName) : null
      state.passwordValueCache = pass
      state.passwordFetched = true
      if (pass && state.qrPath === null && allowQr) {
        state.qrPath = buildWifiQr(currentSavedName ?? "wifi", pass)
      }
      updatePasswordDisplay()
    } catch (err) {
      console.error("a-network password error", err)
      state.passwordFetched = true
      savedValue.set_label("Unavailable")
      qr.set_opacity(0)
    }
  })

  detailsBtn.connect("clicked", () => {
    state.expanded = !detailsReveal.get_reveal_child()
    detailsReveal.set_reveal_child(state.expanded)
    applyMuted()
    if (state.expanded && !detailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  })

  connectBtn.connect("clicked", () => {
    onConnect(currentSsid, currentIsKnown, currentSavedName, state.passwordText)
  })

  if (!isSecure(iface.security)) {
    connectBtn.set_label("Join")
    state.passwordText = ""
  }

  const passwordRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  passwordRow.set_halign(Gtk.Align.FILL)
  passwordRow.set_hexpand(true)
  const passwordEntry = new Gtk.Entry()
  passwordEntry.set_visibility(false)
  passwordEntry.set_placeholder_text("Password")
  passwordEntry.set_hexpand(true)
  passwordEntry.set_halign(Gtk.Align.FILL)
  passwordEntry.connect("changed", () => {
    state.passwordText = passwordEntry.get_text()
  })
  const showToggle = new Gtk.Switch()
  showToggle.add_css_class("a-network-switch")
  showToggle.set_valign(Gtk.Align.CENTER)
  const showLabel = new Gtk.Label({ label: "Show", xalign: 0 })
  showLabel.add_css_class("a-network-details-label")
  showToggle.connect("notify::active", () => {
    const show = showToggle.get_active()
    passwordEntry.set_visibility(show)
  })
  if (!isSecure(iface.security)) {
    passwordEntry.set_sensitive(false)
  }
  passwordRow.append(passwordEntry)
  passwordRow.append(showLabel)
  passwordRow.append(showToggle)
  const passwordContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  passwordContainer.append(passwordRow)
  passwordContainer.set_visible(!currentIsKnown && isSecure(iface.security))
  passwordContainer.add_css_class("a-network-row-details")

  const update = (nextIface: WifiNetwork, nextKnown: boolean, nextSavedName?: string) => {
    const prevSavedName = currentSavedName
    currentSsid = nextIface.ssid
    currentSecurity = nextIface.security
    currentSignal = nextIface.signal
    currentIsKnown = nextKnown
    currentSavedName = nextSavedName
    if (prevSavedName !== nextSavedName) {
      detailsLoaded = false
    }
    if (!currentIsKnown) {
      state.lastConnected = null
    }
    icon.set_from_icon_name(signalIcon(nextIface.signal))
    label.set_label(nextIface.ssid)
    meta.set_label(`${formatSignal(nextIface.signal)} ${nextIface.security ?? "--"}`)
    infoCol.setInfo({
      ssid: currentSsid,
      security: currentSecurity ?? "--",
      lastConnected: state.lastConnected ?? undefined,
      signal: currentSignal,
    })
    passwordContainer.set_visible(!currentIsKnown && isSecure(nextIface.security))
    applyFlags()
  }

  container.append(row)
  container.append(passwordContainer)
  container.append(detailsReveal)

  update(iface, isKnown, savedName)
  updatePasswordDisplay()
  return { container, update }
}

export function createWifiSection(cfg: NetworkWidgetConfig, service: NetworkService) {
  let activeConnectionName: string | undefined
  let wifiWasEnabled: boolean | null = null

  const wifiSwitch = new Gtk.Switch()
  wifiSwitch.add_css_class("a-network-switch")
  wifiSwitch.set_hexpand(false)
  wifiSwitch.set_halign(Gtk.Align.END)
  wifiSwitch.set_valign(Gtk.Align.CENTER)
  wifiSwitch.set_vexpand(false)
  wifiSwitch.connect("notify::active", () => {
    service.setWifiEnabled(wifiSwitch.get_active()).catch(err => console.error("a-network wifi toggle error", err))
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
  scanBtn.connect("clicked", () => {
    service.scanWifi().catch(err => console.error("a-network scan error", err))
  })

  const wifiOff = new Gtk.Label({ label: "Wi-Fi is off", xalign: 0 })
  wifiOff.add_css_class("a-network-muted")
  wifiOff.set_visible(false)
  const wifiHeaderRight = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  wifiHeaderRight.set_halign(Gtk.Align.END)
  wifiHeaderRight.append(wifiOff)
  wifiHeaderRight.append(scanBtn)
  wifiHeaderRight.append(wifiSwitch)
  const wifiCollapsedInfo = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  wifiCollapsedInfo.add_css_class("a-network-section-collapsed-info")
  const wifiCollapsedIcon = new Gtk.Image({ pixel_size: 16 })
  wifiCollapsedIcon.add_css_class("a-network-section-collapsed-icon")
  const wifiCollapsedLabel = new Gtk.Label({ label: "No connection", xalign: 0 })
  wifiCollapsedLabel.add_css_class("a-network-section-collapsed-text")
  wifiCollapsedInfo.append(wifiCollapsedIcon)
  wifiCollapsedInfo.append(wifiCollapsedLabel)

  const wifiBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  wifiBody.add_css_class("a-network-section-body")
  const wifiReveal = new Gtk.Revealer({ reveal_child: true })
  wifiReveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  wifiReveal.set_child(wifiBody)
  const wifiConnectedTitle = new Gtk.Label({ label: "Connected", xalign: 0 })
  wifiConnectedTitle.add_css_class("a-network-subtitle")
  wifiConnectedTitle.set_visible(false)
  const connectedRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  connectedRow.add_css_class("a-network-row")
  connectedRow.set_visible(false)
  const connectedIcon = new Gtk.Image({ pixel_size: 16 })
  const connectedLabel = new Gtk.Label({ label: "--", xalign: 0 })
  connectedLabel.set_hexpand(true)
  const connectedMeta = new Gtk.Label({ label: "--", xalign: 1 })
  connectedMeta.add_css_class("a-network-row-meta")
  const connectedActions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  connectedActions.set_halign(Gtk.Align.END)
  const connectedDetailsBtn = new Gtk.Button({ label: "Details" })
  connectedDetailsBtn.add_css_class("a-network-action")
  const connectedDisconnectBtn = new Gtk.Button({ label: "Disconnect" })
  connectedDisconnectBtn.add_css_class("a-network-action")
  connectedActions.append(connectedDetailsBtn)
  connectedActions.append(connectedDisconnectBtn)
  connectedRow.append(connectedIcon)
  connectedRow.append(connectedLabel)
  connectedRow.append(connectedMeta)
  connectedRow.append(connectedActions)
  const connectedDetailsReveal = new Gtk.Revealer({ reveal_child: false })
  connectedDetailsReveal.set_visible(false)
  const connectedDetailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  connectedDetailsBox.add_css_class("a-network-details")
  connectedDetailsBox.set_hexpand(true)
  connectedDetailsBox.set_halign(Gtk.Align.FILL)
  const connectedInfo = createInfoColumn()
  connectedInfo.box.set_hexpand(true)
  const connectedPasswordCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  connectedPasswordCol.add_css_class("a-network-details-col")
  const connectedPasswordRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const connectedPasswordLabel = new Gtk.Label({ label: "Password", xalign: 0 })
  connectedPasswordLabel.add_css_class("a-network-details-label")
  const connectedToggleLabel = new Gtk.Label({ label: "Show", xalign: 0 })
  connectedToggleLabel.add_css_class("a-network-details-label")
  const connectedPasswordToggle = new Gtk.Switch()
  connectedPasswordToggle.add_css_class("a-network-switch")
  connectedPasswordRow.append(connectedPasswordLabel)
  connectedPasswordRow.append(connectedToggleLabel)
  connectedPasswordRow.append(connectedPasswordToggle)
  const connectedPasswordValue = new Gtk.Label({ label: "Hidden", xalign: 0.5 })
  connectedPasswordValue.add_css_class("a-network-details-value")
  connectedPasswordValue.set_halign(Gtk.Align.CENTER)
  connectedPasswordValue.set_hexpand(true)
  connectedPasswordValue.set_width_chars(24)
  connectedPasswordValue.set_ellipsize(Pango.EllipsizeMode.END)
  connectedPasswordValue.set_max_width_chars(24)
  const connectedQr = new Gtk.Picture()
  connectedQr.set_visible(true)
  connectedQr.set_size_request(128, -1)
  connectedQr.set_can_shrink(true)
  connectedQr.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  connectedQr.set_halign(Gtk.Align.CENTER)
  connectedQr.set_opacity(0)
  connectedPasswordCol.append(connectedPasswordRow)
  connectedPasswordCol.append(connectedPasswordValue)
  const connectedQrSlot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  connectedQrSlot.set_halign(Gtk.Align.CENTER)
  connectedQrSlot.set_size_request(128, -1)
  connectedQrSlot.append(connectedQr)
  connectedPasswordCol.append(connectedQrSlot)
  connectedDetailsBox.append(connectedInfo.box)
  connectedDetailsBox.append(connectedPasswordCol)
  connectedDetailsReveal.set_child(connectedDetailsBox)

  const wifiNearbyTitle = new Gtk.Label({ label: "Nearby", xalign: 0 })
  wifiNearbyTitle.add_css_class("a-network-subtitle")
  const wifiNearbyList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const wifiNearbyPlaceholder = new Gtk.Label({ label: "No networks found", xalign: 0 })
  const wifiNearbyScroll = new Gtk.ScrolledWindow()
  wifiNearbyScroll.add_css_class("a-network-list-scroll")
  wifiNearbyScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  wifiNearbyScroll.set_propagate_natural_height(true)
  wifiNearbyScroll.set_hexpand(true)
  wifiNearbyScroll.set_max_content_height(360)
  wifiNearbyScroll.set_child(wifiNearbyList)

  const wifiSavedTitle = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  wifiSavedTitle.add_css_class("a-network-subtitle")
  wifiSavedTitle.add_css_class("a-network-toggle")
  const wifiSavedChevron = new Gtk.Label({ label: "▸", xalign: 0 })
  wifiSavedChevron.add_css_class("a-network-chevron")
  const wifiSavedLabel = new Gtk.Label({ label: "Saved", xalign: 0 })
  const wifiSavedEmpty = new Gtk.Label({ label: "", xalign: 0 })
  wifiSavedEmpty.add_css_class("a-network-muted")
  wifiSavedTitle.append(wifiSavedChevron)
  wifiSavedTitle.append(wifiSavedLabel)
  wifiSavedTitle.append(wifiSavedEmpty)
  const wifiSavedList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const wifiSavedPlaceholder = new Gtk.Label({ label: "No saved networks", xalign: 0 })
  const wifiSavedScroll = new Gtk.ScrolledWindow()
  wifiSavedScroll.add_css_class("a-network-saved-scroll")
  wifiSavedScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  wifiSavedScroll.set_propagate_natural_height(true)
  wifiSavedScroll.set_hexpand(true)
  wifiSavedScroll.set_max_content_height(360)
  wifiSavedScroll.set_child(wifiSavedList)
  const wifiSavedReveal = new Gtk.Revealer({ reveal_child: false })
  wifiSavedReveal.set_child(wifiSavedScroll)
  const savedClick = new Gtk.GestureClick()
  savedClick.connect("released", () => {
    const next = !wifiSavedReveal.get_reveal_child()
    wifiSavedReveal.set_reveal_child(next)
    wifiSavedChevron.set_label(next ? "▾" : "▸")
  })
  wifiSavedTitle.add_controller(savedClick)

  wifiBody.append(wifiConnectedTitle)
  wifiBody.append(connectedRow)
  wifiBody.append(connectedDetailsReveal)
  wifiBody.append(wifiNearbyTitle)
  wifiBody.append(wifiNearbyScroll)
  wifiBody.append(wifiSavedTitle)
  wifiBody.append(wifiSavedReveal)

  const wifiInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const wifiSection = buildSection("Wi-Fi", wifiHeaderRight, wifiReveal, false, wifiInfoIcon, true, undefined, wifiCollapsedInfo)

  const savedRowState = new Map<string, SavedRowState>()
  const savedRowEntries = new Map<string, SavedRowEntry>()
  const nearbyRowState = new Map<string, WifiRowState>()
  const nearbyRowEntries = new Map<string, WifiRowEntry>()
  let connectedDetailsExpanded = false
  const connectedPasswordState: SavedRowState = {
    expanded: false,
    passwordVisible: false,
    passwordValueCache: null,
    passwordFetched: false,
    qrPath: null,
  }
  let connectedDetailsLoaded = false
  let connectedLoading = false
  let connectedLastConnected: number | null = null
  let connectedKey: string | undefined

  const updateConnectedPasswordDisplay = () => {
    if (!(cfg.showPlainTextPassword ?? true)) {
      connectedPasswordToggle.set_sensitive(false)
      connectedPasswordValue.set_label("Disabled")
      connectedQr.set_opacity(0)
      return
    }
    if (!connectedPasswordState.passwordVisible) {
      connectedPasswordValue.set_label("Hidden")
      connectedQr.set_opacity(0)
      return
    }
    if (connectedPasswordState.passwordFetched) {
      connectedPasswordValue.set_label(connectedPasswordState.passwordValueCache || "Unavailable")
      if (connectedPasswordState.qrPath && connectedPasswordState.passwordValueCache) {
        connectedQr.set_filename(connectedPasswordState.qrPath)
        connectedQr.set_opacity(1)
      } else {
        connectedQr.set_opacity(0)
      }
    }
  }

  const loadConnectedDetails = async () => {
    if (!activeConnectionName) return
    if (connectedLoading) return
    connectedLoading = true
    try {
      const details = await service.getConnectionDetails(activeConnectionName)
      connectedLastConnected = details.lastConnected ?? null
      connectedInfo.setInfo({
        ssid: details.ssid ?? activeConnectionName,
        security: details.security ?? "--",
        lastConnected: details.lastConnected,
        signal: undefined,
      })
      connectedDetailsLoaded = true
    } catch (err) {
      console.error("a-network details error", err)
    } finally {
      connectedLoading = false
    }
  }

  connectedPasswordToggle.connect("notify::active", async () => {
    if (!connectedPasswordToggle.get_active()) {
      connectedPasswordState.passwordVisible = false
      updateConnectedPasswordDisplay()
      return
    }
    connectedPasswordState.passwordVisible = true
    if (connectedPasswordState.passwordFetched) {
      updateConnectedPasswordDisplay()
      return
    }
    connectedPasswordValue.set_label("Loading...")
    try {
      const pass = activeConnectionName ? await service.getWifiPassword(activeConnectionName) : null
      connectedPasswordState.passwordValueCache = pass
      connectedPasswordState.passwordFetched = true
      if (pass && connectedPasswordState.qrPath === null && (cfg.showQRPassword ?? false)) {
        connectedPasswordState.qrPath = buildWifiQr(activeConnectionName ?? "wifi", pass)
      }
      updateConnectedPasswordDisplay()
    } catch (err) {
      console.error("a-network password error", err)
      connectedPasswordState.passwordFetched = true
      connectedPasswordValue.set_label("Unavailable")
      connectedQr.set_opacity(0)
    }
  })

  connectedDetailsBtn.connect("clicked", () => {
    connectedDetailsExpanded = !connectedDetailsReveal.get_reveal_child()
    connectedDetailsReveal.set_reveal_child(connectedDetailsExpanded)
    if (connectedDetailsExpanded && !connectedDetailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadConnectedDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  })
  connectedDisconnectBtn.connect("clicked", () => {
    if (!activeConnectionName) return
    service.disconnectConnection(activeConnectionName).catch(err => console.error("a-network disconnect error", err))
  })

  let spinTimer: number | null = null
  let spinUntil = 0
  const stopSpin = () => {
    scanSpinner.stop()
    scanStack.set_visible_child_name("icon")
    if (spinTimer) {
      GLib.source_remove(spinTimer)
      spinTimer = null
    }
  }

  const startSpin = (minMs: number) => {
    spinUntil = Date.now() + minMs
    scanStack.set_visible_child_name("spin")
    scanSpinner.start()
  }

  scanBtn.connect("clicked", () => {
    startSpin(900)
  })

  createEffect(() => {
    const spinning = service.scanning()
    if (spinning) {
      startSpin(900)
      return
    }
    const remaining = Math.max(0, spinUntil - Date.now())
    if (remaining > 0) {
      if (spinTimer) GLib.source_remove(spinTimer)
      spinTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
        stopSpin()
        return GLib.SOURCE_REMOVE
      })
      return
    }
    stopSpin()
  }, { immediate: true })

  createEffect(() => {
    const data = service.data()
    if (!data) {
      wifiSwitch.set_sensitive(false)
      scanBtn.set_sensitive(false)
      wifiOff.set_visible(false)
      wifiCollapsedIcon.set_visible(false)
      wifiCollapsedLabel.set_label("Loading...")
      return
    }

    const wifiEnabled = Boolean(data.wifiEnabled)
    wifiSwitch.set_sensitive(true)
    scanBtn.set_sensitive(true)
    wifiSwitch.set_active(wifiEnabled)
    scanBtn.set_visible(wifiEnabled)
    wifiOff.set_visible(!wifiEnabled)
    if (!wifiEnabled) {
      const busy = service.wifiBusy()
      wifiOff.set_label(busy && wifiSwitch.get_active() ? "Turning Wi-Fi on..." : "Wi-Fi is off")
      wifiSection.setExpanded(false)
    } else if (wifiWasEnabled === false) {
      wifiSection.setExpanded(true)
    }
    wifiWasEnabled = wifiEnabled
    const connectivity = data.connectivity
    const wifiNoInternet = connectivity !== undefined && connectivity !== "full"
    if (data.activeWifi) {
      activeConnectionName = data.activeWifiConnectionName ?? data.activeWifi.ssid
      if (connectedKey !== activeConnectionName) {
        connectedKey = activeConnectionName
        connectedDetailsLoaded = false
        connectedLastConnected = null
        connectedPasswordState.passwordVisible = false
        connectedPasswordState.passwordValueCache = null
        connectedPasswordState.passwordFetched = false
        connectedPasswordState.qrPath = null
      }
      wifiConnectedTitle.set_visible(true)
      connectedRow.set_visible(true)
      connectedDetailsReveal.set_visible(true)
      connectedIcon.set_from_icon_name(wifiNoInternet ? "network-error-symbolic" : signalIcon(data.activeWifi.signal))
      connectedLabel.set_label(data.activeWifi.ssid)
      connectedMeta.set_label(`${formatSignal(data.activeWifi.signal)} ${data.activeWifi.security ?? "--"}`)
      connectedInfo.setInfo({
        ssid: data.activeWifi.ssid,
        security: data.activeWifi.security ?? "--",
        lastConnected: connectedLastConnected ?? undefined,
        signal: data.activeWifi.signal,
      })
      updateConnectedPasswordDisplay()
      connectedDetailsReveal.set_reveal_child(connectedDetailsExpanded)
    } else {
      activeConnectionName = undefined
      connectedKey = undefined
      connectedDetailsLoaded = false
      connectedLastConnected = null
      connectedPasswordState.passwordVisible = false
      connectedPasswordState.passwordValueCache = null
      connectedPasswordState.passwordFetched = false
      connectedPasswordState.qrPath = null
      wifiConnectedTitle.set_visible(false)
      connectedRow.set_visible(false)
      connectedDetailsReveal.set_visible(false)
      connectedDetailsReveal.set_reveal_child(false)
      connectedDetailsExpanded = false
    }
    if (!wifiEnabled) {
      wifiCollapsedIcon.set_visible(false)
      wifiCollapsedLabel.set_label("")
    } else if (data.activeWifi) {
      wifiCollapsedIcon.set_visible(true)
      wifiCollapsedIcon.set_from_icon_name(wifiNoInternet ? "network-error-symbolic" : signalIcon(data.activeWifi.signal))
      wifiCollapsedLabel.set_label(
        data.activeWifi.ssid ? `Connected: ${data.activeWifi.ssid}` : "Connected",
      )
    } else {
      wifiCollapsedIcon.set_visible(false)
      wifiCollapsedLabel.set_label("No connection")
    }

    const available = data.wifi.filter(iface => !iface.inUse)
    const nearbyAdjustment = wifiNearbyScroll.get_vadjustment()
    const nearbyScrollValue = nearbyAdjustment ? nearbyAdjustment.get_value() : 0
    if (!available.length) {
      for (const [key, entry] of nearbyRowEntries) {
        wifiNearbyList.remove(entry.container)
        nearbyRowEntries.delete(key)
        nearbyRowState.delete(key)
      }
      clearBox(wifiNearbyList)
      wifiNearbyList.append(wifiNearbyPlaceholder)
    } else {
      if (wifiNearbyPlaceholder.get_parent()) {
        wifiNearbyList.remove(wifiNearbyPlaceholder)
      }
      const known = new Map(
        data.savedWifi.flatMap(entry => {
          const pairs: Array<[string, string]> = []
          const ssid = entry.ssid ?? entry.name
          if (ssid) {
            pairs.push([ssid, entry.name])
            pairs.push([ssid.toLowerCase(), entry.name])
          }
          if (entry.name) {
            pairs.push([entry.name, entry.name])
            pairs.push([entry.name.toLowerCase(), entry.name])
          }
          return pairs
        }),
      )
      const seen = new Set<string>()
      let prevChild: Gtk.Widget | null = null
      for (const iface of available) {
        const savedName = known.get(iface.ssid) ?? known.get(iface.ssid.toLowerCase())
        const isKnown = Boolean(savedName)
        const rowKey = `${iface.ssid}::${iface.security ?? ""}`
        seen.add(rowKey)
        let entry = nearbyRowEntries.get(rowKey)
        if (!entry) {
          const state = nearbyRowState.get(rowKey) ?? {
            expanded: false,
            passwordText: "",
            passwordVisible: false,
            passwordValueCache: null,
            passwordFetched: false,
            qrPath: null,
            lastConnected: null,
          }
          nearbyRowState.set(rowKey, state)
          entry = buildWifiRow(
            iface,
            isKnown,
            savedName,
            (ssid, knownNow, savedNow, password) => {
              if (knownNow) {
                service.connectSaved(savedNow ?? ssid).catch(err => console.error("a-network connect error", err))
                return
              }
              service.connectWifi(ssid, password).catch(err => console.error("a-network connect error", err))
            },
            (name) => service.getConnectionDetails(name),
            (name) => service.getWifiPassword(name),
            cfg.showPlainTextPassword ?? true,
            cfg.showQRPassword ?? false,
            state,
          )
          nearbyRowEntries.set(rowKey, entry)
          wifiNearbyList.append(entry.container)
        } else {
          entry.update(iface, isKnown, savedName)
        }
        wifiNearbyList.reorder_child_after(entry.container, prevChild)
        prevChild = entry.container
      }
      for (const [key, entry] of nearbyRowEntries) {
        if (seen.has(key)) continue
        wifiNearbyList.remove(entry.container)
        nearbyRowEntries.delete(key)
        nearbyRowState.delete(key)
      }
    }
    if (nearbyAdjustment) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        const upper = nearbyAdjustment.get_upper()
        const page = nearbyAdjustment.get_page_size()
        const maxValue = Math.max(0, upper - page)
        nearbyAdjustment.set_value(Math.min(nearbyScrollValue, maxValue))
        return GLib.SOURCE_REMOVE
      })
    }

    const savedAdjustment = wifiSavedScroll.get_vadjustment()
    const savedScrollValue = savedAdjustment ? savedAdjustment.get_value() : 0
    const nearbyNames = new Set(available.map(item => item.ssid.toLowerCase()))
    const savedCount = data.savedWifi.length
    wifiSavedEmpty.set_label(`(${savedCount})`)
    if (!savedCount) {
      for (const [name, entry] of savedRowEntries) {
        wifiSavedList.remove(entry.container)
        savedRowEntries.delete(name)
        savedRowState.delete(name)
      }
      clearBox(wifiSavedList)
      wifiSavedList.append(wifiSavedPlaceholder)
    } else {
      if (wifiSavedPlaceholder.get_parent()) {
        wifiSavedList.remove(wifiSavedPlaceholder)
      }
      const seen = new Set<string>()
      let prevChild: Gtk.Widget | null = null
      for (const saved of data.savedWifi) {
        const savedKey = saved.name
        seen.add(savedKey)
        let entry = savedRowEntries.get(savedKey)
        if (!entry) {
          const state = savedRowState.get(savedKey) ?? {
            expanded: false,
            passwordVisible: false,
            passwordValueCache: null,
            passwordFetched: false,
            qrPath: null,
          }
          savedRowState.set(savedKey, state)
          entry = buildSavedRow(
            saved,
            (name, active) => {
              if (active) {
                service.disconnectConnection(name).catch(err => console.error("a-network disconnect error", err))
              } else {
                service.connectSaved(name).catch(err => console.error("a-network connect error", err))
              }
            },
            (name) => service.forgetConnection(name).catch(err => console.error("a-network forget error", err)),
            (name) => service.getConnectionDetails(name),
            (name) => service.getWifiPassword(name),
            cfg.showPlainTextPassword ?? true,
            cfg.showQRPassword ?? false,
            state,
          )
          savedRowEntries.set(savedKey, entry)
          wifiSavedList.append(entry.container)
        } else {
          entry.update(saved)
        }
        const isMuted = !nearbyNames.has((saved.ssid ?? saved.name).toLowerCase()) && !saved.active
        entry.setMuted(isMuted)
        wifiSavedList.reorder_child_after(entry.container, prevChild)
        prevChild = entry.container
      }
      for (const [name, entry] of savedRowEntries) {
        if (seen.has(name)) continue
        wifiSavedList.remove(entry.container)
        savedRowEntries.delete(name)
        savedRowState.delete(name)
      }
    }
    if (savedAdjustment) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        const upper = savedAdjustment.get_upper()
        const page = savedAdjustment.get_page_size()
        const maxValue = Math.max(0, upper - page)
        savedAdjustment.set_value(Math.min(savedScrollValue, maxValue))
        return GLib.SOURCE_REMOVE
      })
    }
  }, { immediate: true })

  return {
    controller: wifiSection,
    setTooltip: (text: string) => {
      if (wifiInfoIcon) wifiInfoIcon.set_tooltip_text(text)
    },
  }
}
