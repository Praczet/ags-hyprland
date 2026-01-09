import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Pango from "gi://Pango"
import { getNetworkService } from "../services/networkService"
import type { ConnectionDetails, NetworkAction, NetworkWidgetConfig, SavedConnection, WifiNetwork } from "../types"

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
  return new Date(ts * 1000).toLocaleString()
}

function createInfoIcon() {
  const label = new Gtk.Label({ label: "?" })
  label.add_css_class("a-network-info-icon")
  return label
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
    const label = new Gtk.Label({ label: labelText, xalign: 0 })
    label.add_css_class("a-network-details-label")
    const value = new Gtk.Label({ label: "--", xalign: 0 })
    value.add_css_class("a-network-details-value")
    value.set_hexpand(true)
    value.set_width_chars(24)
    value.set_ellipsize(Pango.EllipsizeMode.END)
    value.set_max_width_chars(24)
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

function buildSection(
  title: string,
  headerRight: Gtk.Widget | null,
  body: Gtk.Widget,
  expanded = true,
  infoIcon?: Gtk.Widget,
  collapsible = true,
  pillClass?: string,
) {
  const wrapper = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  wrapper.add_css_class("a-network-section")
  wrapper.set_hexpand(true)
  if (pillClass && pillClass.match(/last/)) wrapper.add_css_class("a-network-section-last")


  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  header.add_css_class("a-network-section-header")
  header.add_css_class("a-network-section-pill")
  header.height_request = 56;
  if (pillClass) header.add_css_class(pillClass)

  header.set_hexpand(true)

  const label = new Gtk.Label({ label: title, xalign: 0 })
  label.add_css_class("a-network-section-title")
  label.set_hexpand(true)

  const chevron = new Gtk.Label({ label: expanded ? "▾" : "▸", xalign: 1 })
  chevron.add_css_class("a-network-chevron")

  header.append(label)
  if (infoIcon) header.append(infoIcon)
  if (headerRight) header.append(headerRight)
  header.append(chevron)

  const reveal = new Gtk.Revealer({ reveal_child: expanded })
  reveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  reveal.set_child(body)

  if (collapsible) {
    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      const next = !reveal.get_reveal_child()
      reveal.set_reveal_child(next)
      chevron.set_label(next ? "▾" : "▸")
      if (next) {
        header.remove_css_class("a-network-section-collapsed")
        header.add_css_class("a-network-section-expanded")
      } else {
        header.remove_css_class("a-network-section-expanded")
        header.add_css_class("a-network-section-collapsed")
      }
    })
    header.add_controller(click)
  }

  wrapper.append(header)
  wrapper.append(reveal)
  return wrapper
}

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    box.remove(child)
    child = box.get_first_child()
  }
}

function updateHistoryList(box: Gtk.Box, history: NetworkAction[]) {
  clearBox(box)
  if (!history.length) {
    box.append(new Gtk.Label({ label: "No recent actions", xalign: 0 }))
    return
  }
  for (const entry of history) {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
    row.add_css_class("a-network-history-row")
    const label = new Gtk.Label({ label: entry.action, xalign: 0 })
    label.add_css_class("a-network-history-label")
    const meta = new Gtk.Label({
      label: entry.command ? entry.command : new Date(entry.ts).toLocaleTimeString(),
      xalign: 0,
    })
    meta.add_css_class("a-network-history-meta")
    row.append(label)
    row.append(meta)
    box.append(row)
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
  onConnect: (name: string, active: boolean) => void,
  onForget: (name: string) => void,
  onDetails: (name: string) => Promise<ConnectionDetails>,
  onPassword: (name: string) => Promise<string | null>,
  allowPasswordReveal: boolean,
  allowQr: boolean,
  state: SavedRowState,
): SavedRowEntry {
  let currentName = saved.name
  let currentSsid = saved.ssid
  let currentActive = Boolean(saved.active)
  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  row.add_css_class("a-network-row")

  const label = new Gtk.Label({ label: saved.name, xalign: 0 })
  label.set_hexpand(true)
  if (saved.active) label.add_css_class("a-network-active")

  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const connectBtn = new Gtk.Button({ label: saved.active ? "Disconnect" : "Connect" })
  connectBtn.add_css_class("a-network-action")
  connectBtn.connect("clicked", () => onConnect(currentName, currentActive))
  const detailsBtn = new Gtk.Button({ label: "Details" })
  detailsBtn.add_css_class("a-network-action")
  const forgetBtn = new Gtk.Button({ label: "Forget" })
  forgetBtn.add_css_class("a-network-action")
  forgetBtn.connect("clicked", () => onForget(currentName))

  actions.append(connectBtn)
  actions.append(detailsBtn)
  actions.append(forgetBtn)

  row.append(label)
  row.append(actions)

  const detailsReveal = new Gtk.Revealer({ reveal_child: false })
  detailsReveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  detailsBox.add_css_class("a-network-details")
  detailsBox.set_hexpand(true)
  detailsBox.set_halign(Gtk.Align.FILL)
  detailsBox.set_hexpand(true)
  detailsBox.set_halign(Gtk.Align.FILL)

  const infoCol = createInfoColumn()
  infoCol.box.set_hexpand(true)
  infoCol.box.set_hexpand(true)

  const passwordCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  passwordCol.add_css_class("a-network-details-col")
  passwordCol.set_size_request(128, -1)
  const passwordRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const passwordLabel = new Gtk.Label({ label: "Password", xalign: 0 })
  passwordLabel.add_css_class("a-network-details-label")
  const passwordToggle = new Gtk.Switch()
  passwordToggle.add_css_class("a-network-switch")
  const toggleLabel = new Gtk.Label({ label: "Show", xalign: 0 })
  toggleLabel.add_css_class("a-network-details-label")
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
  const qrImage = new Gtk.Picture()
  qrImage.set_visible(true)
  qrImage.set_size_request(128, -1)
  qrImage.set_can_shrink(true)
  qrImage.set_content_fit(Gtk.ContentFit.CONTAIN)
  qrImage.set_halign(Gtk.Align.CENTER)
  qrImage.set_opacity(0)
  const qrSlot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  qrSlot.set_halign(Gtk.Align.CENTER)
  qrSlot.set_size_request(128, -1)
  qrSlot.append(qrImage)
  passwordCol.append(passwordRow)
  passwordCol.append(passwordValue)
  passwordCol.append(qrSlot)

  let muted = false
  const setMutedState = (nextMuted: boolean) => {
    muted = nextMuted
    if (state.expanded) {
      container.remove_css_class("a-network-muted")
    } else if (muted) {
      container.add_css_class("a-network-muted")
    } else {
      container.remove_css_class("a-network-muted")
    }
  }

  detailsBox.append(infoCol.box)
  detailsBox.append(passwordCol)
  detailsReveal.set_child(detailsBox)

  let detailsLoaded = false
  let loadingDetails = false

  const loadDetails = async () => {
    if (loadingDetails) return
    loadingDetails = true
    infoCol.setInfo({ ssid: "Loading...", security: "Loading...", lastConnected: undefined, signal: undefined })
    try {
      const details = await onDetails(currentName)
      const ssid = details.ssid ?? currentSsid ?? currentName
      infoCol.setInfo({
        ssid: ssid || "--",
        security: details.security ?? "--",
        lastConnected: details.lastConnected,
        signal: undefined,
      })
      detailsLoaded = true
    } catch (err) {
      console.error("a-network details error", err)
      infoCol.setInfo({
        ssid: currentSsid ?? currentName ?? "--",
        security: "--",
        lastConnected: undefined,
        signal: undefined,
      })
    } finally {
      loadingDetails = false
    }
  }

  const toggleDetails = (next: boolean) => {
    state.expanded = next
    detailsReveal.set_reveal_child(next)
    setMutedState(muted)
    if (next && !detailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  }

  detailsBtn.connect("clicked", () => {
    toggleDetails(!detailsReveal.get_reveal_child())
  })

  if (!allowPasswordReveal) {
    passwordToggle.set_sensitive(false)
    passwordValue.set_label("Disabled")
  } else {
    let ignorePasswordToggle = false
    passwordToggle.connect("notify::active", async () => {
      if (ignorePasswordToggle) return
      if (!passwordToggle.get_active()) {
        state.passwordVisible = false
        passwordValue.set_label("Hidden")
        qrImage.set_opacity(0)
        return
      }
      state.passwordVisible = true
      if (state.passwordFetched) {
        passwordValue.set_label(state.passwordValueCache || "Unavailable")
        if (state.qrPath && state.passwordValueCache) {
          qrImage.set_filename(state.qrPath)
          qrImage.set_opacity(1)
        } else {
          qrImage.set_opacity(0)
        }
        return
      }
      passwordValue.set_label("Loading...")
      try {
        const pass = await onPassword(currentName)
        state.passwordValueCache = pass
        state.passwordFetched = true
        passwordValue.set_label(pass || "Unavailable")
        if (pass && state.qrPath === null && allowQr) {
          state.qrPath = buildWifiQr(currentName, pass)
        }
        if (state.qrPath && pass) {
          qrImage.set_filename(state.qrPath)
          qrImage.set_opacity(1)
        } else {
          qrImage.set_opacity(0)
        }
      } catch (err) {
        console.error("a-network password error", err)
        state.passwordFetched = true
        passwordValue.set_label("Unavailable")
        qrImage.set_opacity(0)
      }
    })

    if (state.passwordVisible) {
      ignorePasswordToggle = true
      passwordToggle.set_active(true)
      ignorePasswordToggle = false
      if (state.passwordFetched) {
        passwordValue.set_label(state.passwordValueCache || "Unavailable")
        if (state.qrPath && state.passwordValueCache) {
          qrImage.set_filename(state.qrPath)
          qrImage.set_opacity(1)
        } else {
          qrImage.set_opacity(0)
        }
      } else {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
          passwordToggle.set_active(true)
          return GLib.SOURCE_REMOVE
        })
      }
    }
  }

  container.append(row)
  container.append(detailsReveal)
  setMutedState(false)
  if (state.expanded) {
    detailsReveal.set_reveal_child(true)
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      loadDetails().catch(err => console.error("a-network details error", err))
      return GLib.SOURCE_REMOVE
    })
  }
  return {
    container,
    update: (nextSaved) => {
      currentName = nextSaved.name
      currentSsid = nextSaved.ssid
      currentActive = Boolean(nextSaved.active)
      label.set_label(currentName)
      connectBtn.set_label(currentActive ? "Disconnect" : "Connect")
      if (currentActive) {
        label.add_css_class("a-network-active")
      } else {
        label.remove_css_class("a-network-active")
      }
    },
    setMuted: (nextMuted) => {
      setMutedState(nextMuted)
    },
  }
}

function buildWifiRow(
  iface: WifiNetwork,
  isKnown: boolean,
  savedName: string | undefined,
  onConnect: (ssid: string, known: boolean, savedName?: string, password?: string) => void,
  onDetails: (name: string) => Promise<ConnectionDetails>,
  onPassword: (name: string) => Promise<string | null>,
  allowPasswordReveal: boolean,
  allowQr: boolean,
  state: WifiRowState,
): WifiRowEntry {
  let currentSsid = iface.ssid
  let currentSecurity = iface.security
  let currentSignal = iface.signal
  let currentIsKnown = isKnown
  let currentSavedName = savedName
  let detailsLoaded = false
  let loadingDetails = false

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("a-network-row")

  const wrap = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  const icon = new Gtk.Image({ pixel_size: 16 })
  icon.set_from_icon_name(signalIcon(iface.signal))
  const label = new Gtk.Label({ label: iface.ssid, xalign: 0 })
  label.set_hexpand(true)
  const lock = new Gtk.Image({ pixel_size: 14 })
  lock.set_from_icon_name("network-wireless-encrypted-symbolic")
  const meta = new Gtk.Label({ label: `${formatSignal(iface.signal)} ${iface.security ?? "--"}`, xalign: 1 })
  meta.add_css_class("a-network-row-meta")

  wrap.append(icon)
  wrap.append(label)
  wrap.append(lock)
  wrap.append(meta)
  wrap.set_hexpand(true)

  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const detailsBtn = new Gtk.Button({ label: "Details" })
  detailsBtn.add_css_class("a-network-action")
  const connectBtn = new Gtk.Button({ label: "Connect" })
  connectBtn.add_css_class("a-network-action")
  actions.append(detailsBtn)
  actions.append(connectBtn)

  row.append(wrap)
  row.append(actions)

  const details = new Gtk.Revealer({ reveal_child: false })
  details.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
  detailsBox.add_css_class("a-network-details")

  const infoCol = createInfoColumn()
  infoCol.setInfo({
    ssid: currentSsid,
    security: currentSecurity ?? "--",
    lastConnected: state.lastConnected ?? undefined,
    signal: currentSignal,
  })

  const rightCol = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  rightCol.add_css_class("a-network-details-col")
  const rightStack = new Gtk.Stack()
  rightStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  rightStack.set_transition_duration(120)
  rightCol.append(rightStack)

  const savedBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  const savedRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const savedLabel = new Gtk.Label({ label: "Password", xalign: 0 })
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
  const savedQr = new Gtk.Picture()
  savedQr.set_visible(true)
  savedQr.set_size_request(128, -1)
  savedQr.set_can_shrink(true)
  savedQr.set_content_fit(Gtk.ContentFit.SCALE_DOWN)
  savedQr.set_halign(Gtk.Align.CENTER)
  savedQr.set_opacity(0)
  savedBox.append(savedRow)
  savedBox.append(savedValue)
  const savedQrSlot = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  savedQrSlot.set_halign(Gtk.Align.CENTER)
  savedQrSlot.set_size_request(128, -1)
  savedQrSlot.append(savedQr)
  savedBox.append(savedQrSlot)

  const joinBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const joinEntry = new Gtk.Entry()
  joinEntry.set_visibility(false)
  joinEntry.set_placeholder_text("Password")
  const joinBtn = new Gtk.Button({ label: "Join" })
  joinBtn.add_css_class("a-network-action")
  joinBox.append(joinEntry)
  joinBox.append(joinBtn)

  const openBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  const openLabel = new Gtk.Label({ label: "Open network", xalign: 0 })
  openLabel.add_css_class("a-network-details-value")
  openBox.append(openLabel)

  rightStack.add_named(savedBox, "saved")
  rightStack.add_named(joinBox, "join")
  rightStack.add_named(openBox, "open")

  detailsBox.append(infoCol.box)
  detailsBox.append(rightCol)
  details.set_child(detailsBox)

  const updateSavedDisplay = () => {
    if (!allowPasswordReveal) {
      savedToggle.set_sensitive(false)
      savedValue.set_label("Disabled")
      savedQr.set_opacity(0)
      return
    }
    if (!state.passwordVisible) {
      savedValue.set_label("Hidden")
      savedQr.set_opacity(0)
      return
    }
    if (state.passwordFetched) {
      savedValue.set_label(state.passwordValueCache || "Unavailable")
      if (state.qrPath && state.passwordValueCache) {
        savedQr.set_filename(state.qrPath)
        savedQr.set_opacity(1)
      } else {
        savedQr.set_opacity(0)
      }
    }
  }

  const loadDetails = async () => {
    if (!currentIsKnown || !currentSavedName) return
    if (loadingDetails) return
    loadingDetails = true
    try {
      const detailsData = await onDetails(currentSavedName)
      state.lastConnected = detailsData.lastConnected ?? null
      infoCol.setInfo({
        ssid: detailsData.ssid ?? currentSsid,
        security: detailsData.security ?? currentSecurity ?? "--",
        lastConnected: detailsData.lastConnected,
        signal: currentSignal,
      })
      detailsLoaded = true
    } catch (err) {
      console.error("a-network details error", err)
    } finally {
      loadingDetails = false
    }
  }

  let ignoreSavedToggle = false
  const applyFlags = () => {
    const secure = isSecure(currentSecurity)
    lock.set_visible(secure)
    if (secure && !currentIsKnown) {
      rightStack.set_visible_child_name("join")
      joinEntry.set_text(state.passwordText)
    } else if (currentIsKnown) {
      rightStack.set_visible_child_name("saved")
      savedToggle.set_sensitive(allowPasswordReveal)
      ignoreSavedToggle = true
      savedToggle.set_active(state.passwordVisible)
      ignoreSavedToggle = false
      updateSavedDisplay()
    } else {
      rightStack.set_visible_child_name("open")
    }
  }

  detailsBtn.connect("clicked", () => {
    state.expanded = !details.get_reveal_child()
    details.set_reveal_child(state.expanded)
    if (state.expanded && currentIsKnown && !detailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  })

  connectBtn.connect("clicked", () => {
    const secure = isSecure(currentSecurity)
    if (!secure || currentIsKnown) {
      onConnect(currentSsid, currentIsKnown, currentSavedName)
      return
    }
    state.expanded = true
    details.set_reveal_child(true)
  })

  joinBtn.connect("clicked", () => {
    onConnect(currentSsid, currentIsKnown, currentSavedName, joinEntry.get_text() || undefined)
  })

  joinEntry.connect("changed", () => {
    state.passwordText = joinEntry.get_text()
  })

  savedToggle.connect("notify::active", async () => {
    if (ignoreSavedToggle) return
    if (!savedToggle.get_active()) {
      state.passwordVisible = false
      updateSavedDisplay()
      return
    }
    state.passwordVisible = true
    if (state.passwordFetched) {
      updateSavedDisplay()
      return
    }
    savedValue.set_label("Loading...")
    try {
      const pass = await onPassword(currentSavedName ?? currentSsid)
      state.passwordValueCache = pass
      state.passwordFetched = true
      if (pass && state.qrPath === null && allowQr) {
        state.qrPath = buildWifiQr(currentSavedName ?? currentSsid, pass)
      }
      updateSavedDisplay()
    } catch (err) {
      console.error("a-network password error", err)
      state.passwordFetched = true
      savedValue.set_label("Unavailable")
      savedQr.set_opacity(0)
    }
  })

  container.append(row)
  container.append(details)
  applyFlags()

  if (state.expanded) {
    details.set_reveal_child(true)
    if (currentIsKnown && !detailsLoaded) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        loadDetails().catch(err => console.error("a-network details error", err))
        return GLib.SOURCE_REMOVE
      })
    }
  }

  return {
    container,
    update: (nextIface, nextKnown, nextSavedName) => {
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
      applyFlags()
    },
  }
}

export function NetworkWidget(cfg: NetworkWidgetConfig = {}) {
  const service = getNetworkService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  root.add_css_class("a-network-root")
  if (cfg.windowLess) root.add_css_class("a-network-windowless")
  let activeConnectionName: string | undefined

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
  const firstPill = "a-network-pill-first"
  const middlePill = "a-network-pill-middle"
  const lastPill = "a-network-pill-last"
  const wifiSection = buildSection("Wi-Fi", wifiHeaderRight, wifiReveal, true, wifiInfoIcon, true, firstPill)

  const wiredBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  wiredBody.add_css_class("a-network-section-body")
  const wiredStatus = new Gtk.Label({ label: "No wired connection", xalign: 0 })
  wiredBody.append(wiredStatus)
  const wiredInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const wiredSection = buildSection("Wired", null, wiredBody, false, wiredInfoIcon, true, middlePill)

  const vpnBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  vpnBody.add_css_class("a-network-section-body")
  const vpnList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const vpnScroll = new Gtk.ScrolledWindow()
  vpnScroll.add_css_class("a-network-list-scroll")
  vpnScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  vpnScroll.set_propagate_natural_height(true)
  vpnScroll.set_hexpand(true)
  vpnScroll.set_max_content_height(240)
  vpnScroll.set_child(vpnList)
  vpnBody.append(vpnScroll)
  const vpnInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const vpnSection = buildSection("VPN", null, vpnBody, false, vpnInfoIcon, true, middlePill)

  const hotspotBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  hotspotBody.add_css_class("a-network-section-body")
  const hotspotStatus = new Gtk.Label({ label: "Hotspot disabled", xalign: 0 })
  hotspotBody.append(hotspotStatus)
  const hotspotInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const hotspotSection = buildSection("Hotspot", null, hotspotBody, false, hotspotInfoIcon, true, lastPill)

  const footer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footer.add_css_class("a-network-education")
  const footerLabel = new Gtk.Label({ label: "Education mode", xalign: 0 })
  footerLabel.add_css_class("a-network-education-label")
  const footerHistory = new Gtk.Revealer({ reveal_child: false })
  const footerHistoryBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footerHistoryBox.add_css_class("a-network-history")
  footerHistory.set_child(footerHistoryBox)
  footer.append(footerLabel)
  footer.append(footerHistory)

  footerLabel.add_controller(
    (() => {
      const click = new Gtk.GestureClick()
      click.connect("released", () => {
        footerHistory.set_reveal_child(!footerHistory.get_reveal_child())
      })
      return click
    })(),
  )

  const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panel.add_css_class("a-network-education-panel")
  const panelTitle = new Gtk.Label({ label: "Education", xalign: 0 })
  panelTitle.add_css_class("a-network-subtitle")
  const panelHistory = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panelHistory.add_css_class("a-network-history")
  panel.append(panelTitle)
  panel.append(panelHistory)

  const lastFooter = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  lastFooter.add_css_class("a-network-footer")
  const lastFooterLabel = new Gtk.Label({ label: "Last: --", xalign: 1, halign: Gtk.Align.CENTER, hexpand: true })
  lastFooterLabel.add_css_class("a-network-footer-label")
  lastFooter.append(lastFooterLabel)

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

  root.append(wifiSection)
  root.append(wiredSection)
  root.append(vpnSection)
  root.append(hotspotSection)

  if (cfg.educationModeOn && cfg.educationModeDetail === "panel") {
    root.append(panel)
  } else if (cfg.educationModeOn && cfg.educationModeDetail === "footer") {
    root.append(footer)
  }
  root.append(lastFooter)

  createEffect(() => {
    const data = service.data()
    if (!data) return

    const wifiEnabled = Boolean(data.wifiEnabled)
    wifiSwitch.set_active(wifiEnabled)
    scanBtn.set_visible(wifiEnabled)
    wifiReveal.set_reveal_child(wifiEnabled)
    wifiOff.set_visible(!wifiEnabled)
    if (!wifiEnabled) {
      const busy = service.wifiBusy()
      wifiOff.set_label(busy && wifiSwitch.get_active() ? "Turning Wi-Fi on..." : "Wi-Fi is off")
    }
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
      connectedIcon.set_from_icon_name(signalIcon(data.activeWifi.signal))
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

    const wired = data.wired
    if (wired?.device) {
      const state = wired.state ?? "unknown"
      const ip = wired.ip ? ` (${wired.ip})` : ""
      wiredStatus.set_label(`${wired.device} ${state}${ip}`)
    } else {
      wiredStatus.set_label("No wired connection")
    }

    clearBox(vpnList)
    if (!data.vpn.length) {
      vpnList.append(new Gtk.Label({ label: "No active VPN", xalign: 0 }))
    } else {
      for (const vpn of data.vpn) {
        const row = new Gtk.Label({ label: vpn.name, xalign: 0 })
        row.add_css_class("a-network-row")
        vpnList.append(row)
      }
    }

    if (data.hotspot?.active) {
      hotspotStatus.set_label(`Hotspot active: ${data.hotspot.name ?? "unknown"}`)
    } else {
      hotspotStatus.set_label("Hotspot disabled")
    }
  }, { immediate: true })

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
    const history = service.history()
    if (!cfg.educationModeOn) return
    const latest = history[0]
    const tooltip = latest ? `${latest.action}\n${latest.command ?? ""}`.trim() : "No recent actions"
    if (wifiInfoIcon) wifiInfoIcon.set_tooltip_text(tooltip)
    if (wiredInfoIcon) wiredInfoIcon.set_tooltip_text(tooltip)
    if (vpnInfoIcon) vpnInfoIcon.set_tooltip_text(tooltip)
    if (hotspotInfoIcon) hotspotInfoIcon.set_tooltip_text(tooltip)

    if (cfg.educationModeDetail === "footer") {
      footerLabel.set_label(latest ? `Education: ${latest.action}` : "Education: idle")
      updateHistoryList(footerHistoryBox, history)
    }
    if (cfg.educationModeDetail === "panel") {
      updateHistoryList(panelHistory, history)
    }
  }, { immediate: true })

  createEffect(() => {
    const history = service.history()
    const latest = history[0]
    const cmd = latest?.command ? ` • ${latest.command}` : ""
    lastFooterLabel.set_label(latest ? `Last: ${latest.action}${cmd}` : "Last: --")
  }, { immediate: true })

  const refreshConfig = {
    allowBackgroundRefresh: cfg.allowBackgroundRefresh ?? false,
    refreshOnShow: cfg.refreshOnShow ?? true,
    refreshMs: cfg.refreshMs,
  }
  service.setActive("a-network-widget", false, refreshConfig)
  root.connect("map", () => {
    service.setActive("a-network-widget", true, refreshConfig)
  })
  root.connect("unmap", () => {
    service.setActive("a-network-widget", false, refreshConfig)
  })

  return root
}
